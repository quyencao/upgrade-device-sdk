const path = require("path");
const amqp = require("amqplib");
const mkdirp = require("mkdirp");
const ProcessManager = require("./ProcessManager");
const {
  DEPLOY_MODEL,
  DEPLOY_SOURCE,
  RUN_CODE,
  STOP_DEPLOY_MODEL,
  STOP_DEPLOY_SOURCE,
  STOP_RUN_CODE,
  BASE_SOURCE_DIRECTORY,
  BASE_MODEL_DIRECTORY,
  BASE_TMP_SOURCE_DIRECTORY,
  BASE_TMP_MODEL_DIRECTORY
} = require("./config");
const { publishMessage, validateConfig } = require("./utils");
const [check, config] = validateConfig();

if (!check) {
  console.log("Invalid config file");
  process.exit(0);
}

const QUEUE = config.code;
const opts = {
  // cert: fs.readFileSync('../etc/client/cert.pem'),
  // key: fs.readFileSync('../etc/client/key.pem'),
  // cert and key or
  // pfx: fs.readFileSync('../etc/client/keycert.p12'),
  // passphrase: 'MySecretPassword',
  // ca: [fs.readFileSync('../etc/testca/cacert.pem')]
};
const pm = new ProcessManager();

function connectRabbitMQ() {
  amqp
    .connect(
      {
        hostname: config.host || "localhost",
        port: config.port || 5672,
        username: "guest",
        password: "guest",
        vhost: "/",
        protocol: "amqp"
      },
      opts
    )
    .then(function(conn) {
      process.once("SIGINT", function() {
        conn.close();
      });

      conn.on("close", function() {
        console.error(
          "Lost connection to RabbitMQ.  Reconnecting in 2 seconds..."
        );
        return setTimeout(connectRabbitMQ, 2 * 1000);
      });

      return conn.createChannel().then(function(ch) {
        let ok = ch.assertQueue(QUEUE, { durable: false });

        ok = ok.then(function(_qok) {
          return ch.consume(
            QUEUE,
            function(data) {
              const message = JSON.parse(data.content.toString());
              const command = message.command;
              const node = message.node || "default";
              const key = message.key;
              const downloadFile = path.join(__dirname, "download.js");
              const base_source_directory = config.source_directory || BASE_SOURCE_DIRECTORY;
              const base_model_directory = config.model_directory || BASE_MODEL_DIRECTORY;

              switch (command) {
                case DEPLOY_MODEL:
                  console.log("command", command);

                  pm.stopByUid(node, DEPLOY_MODEL);

                  const onExitDownloadModel = function(code) {
                    console.log("on exit download model from outside", code);

                    if (code === 0) {
                      publishMessage(ch, command, QUEUE, node, key, 0);
                    } else {
                      publishMessage(ch, command, QUEUE, node, key, -1);
                    }
                  };

                  pm.start(
                    downloadFile,
                    {
                      uid: node,
                      max: 1,
                      killTree: true,
                      // pidFile: '/var/run/downloadmodel.pid',
                      env: {
                        directory: `${base_model_directory}/${node}`,
                        tmp_directory: `${BASE_TMP_MODEL_DIRECTORY}/${node}`,
                        url: message.data.url,
                        filename: "model.zip"
                      }
                    },
                    DEPLOY_MODEL,
                    { onExit: onExitDownloadModel }
                  );

                  break;
                case DEPLOY_SOURCE:
                  console.log("command", command);

                  pm.stopByUid(node, DEPLOY_SOURCE);

                  const onExitDownloadSource = function(code) {
                    console.log("on exit download source from outside", code);

                    if (code === 0) {
                      publishMessage(ch, command, QUEUE, node, key, 0);
                    } else {
                      publishMessage(ch, command, QUEUE, node, key, -1);
                    }
                  };

                  pm.start(
                    downloadFile,
                    {
                      uid: node,
                      max: 1,
                      killTree: true,
                      // pidFile: '/var/run/downloadmodel.pid',
                      env: {
                        directory: `${base_source_directory}/${node}`,
                        tmp_directory: `${BASE_TMP_SOURCE_DIRECTORY}/${node}`,
                        url: message.data.url,
                        filename: "source.zip"
                      }
                    },
                    DEPLOY_SOURCE,
                    { onExit: onExitDownloadSource }
                  );

                  break;
                case STOP_DEPLOY_MODEL:
                  console.log("command", command);
                  pm.stopByUid(node, DEPLOY_MODEL);
                  break;
                case STOP_DEPLOY_SOURCE:
                  console.log("command", command);
                  pm.stopByUid(node, DEPLOY_SOURCE);
                  break;
                case STOP_RUN_CODE:
                  console.log("command", command);
                  pm.stopByUid(node, RUN_CODE);
                  break;
                case RUN_CODE:
                  console.log("command", command);

                  const onExitRun = function(code) {
                    if (code !== 0) {
                      publishMessage(ch, command, QUEUE, node, key, -1);
                    }
                  };

                  const onExitInstall = function(code) {
                    console.log("on exit install from outside", code);

                    if (code === 0) {
                      publishMessage(ch, command, QUEUE, node, key, 0);

                      pm.start(
                        "twain.py",
                        {
                          uid: node,
                          command: "python3",
                          max: 1,
                          killTree: true,
                          env: {
                            SOURCE_DIRECTORY: `${base_source_directory}/${node}`,
                            MODEL_DIRECTORY: `${base_model_directory}/${node}`
                          },
                          cwd: `${base_source_directory}/${node}`
                        },
                        RUN_CODE,
                        { onExit: onExitRun }
                      );
                    } else {
                      publishMessage(ch, command, QUEUE, node, key, -1);
                    }
                  };

                  pm.stopByUid(node, RUN_CODE);
                  mkdirp.sync(`${base_source_directory}/${node}`);
                  mkdirp.sync(`${base_model_directory}/${node}`);

                  pm.start(
                    "install.sh",
                    {
                      uid: node,
                      command: "bash",
                      max: 1,
                      killTree: true,
                      env: {
                        SOURCE_DIRECTORY: `${base_source_directory}/${node}`,
                        MODEL_DIRECTORY: `${base_model_directory}/${node}`
                      },
                      cwd: `${base_source_directory}/${node}`
                    },
                    RUN_CODE,
                    { onExit: onExitInstall }
                  );

                  break;
                default:
                  break;
              }
            },
            { noAck: true }
          );
        });

        return ok.then(function(_consumeOk) {
          console.log(" [*] Waiting for messages. To exit press CTRL+C");
        });
      });
    })
    .catch(function(err) {
      setTimeout(connectRabbitMQ, 2 * 1000);
      return console.log("Connection failed. Reconnecting in 2 seconds...");
    });
}

connectRabbitMQ();
