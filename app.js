const path = require("path");
const amqp = require("amqplib");
const ProcessManager = require("./ProcessManager");
const {
  QUEUE,
  DEPLOY_MODEL,
  DEPLOY_SOURCE,
  RUN_CODE,
  STOP_DEPLOY_MODEL,
  STOP_DEPLOY_SOURCE,
  STOP_RUN_CODE
} = require("./config");
const { publishMessage } = require("./utils");
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
        hostname: "localhost",
        port: 5672,
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

              switch (command) {
                case DEPLOY_MODEL:
                  console.log("command", command);

                  pm.stopByUid(node, DEPLOY_MODEL);

                  const onExitDownloadModel = function(code) {
                    console.log("on exit download model from outside", code);

                    if (code === 0) {
                      publishMessage(ch, QUEUE, node, key, "Success");
                    } else {
                      publishMessage(ch, QUEUE, node, key, "Fail");
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
                        directory: `${__dirname}/test_samples/model/${node}`,
                        tmp_directory: `${__dirname}/test_samples/tmp/model/${node}`,
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
                      publishMessage(ch, QUEUE, node, key, "Success");
                    } else {
                      publishMessage(ch, QUEUE, node, key, "Fail");
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
                        directory: `${__dirname}/test_samples/source/${node}`,
                        tmp_directory: `${__dirname}/test_samples/tmp/source/${node}`,
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
                      publishMessage(ch, QUEUE, node, key, "Fail");
                    }
                  };

                  const onExitInstall = function(code) {
                    console.log("on exit install from outside", code);

                    if (code === 0) {
                      publishMessage(ch, QUEUE, node, key, "Running...");

                      pm.start(
                        "main.py",
                        {
                          uid: node,
                          command: "python",
                          max: 1,
                          killTree: true,
                          env: {
                            SOURCE_DIRECTORY: "/twain/code",
                            MODEL_DIRECTORY: "/twain/model"
                          },
                          cwd: `${__dirname}/test_samples/source/${node}`
                        },
                        RUN_CODE,
                        { onExit: onExitRun }
                      );
                    } else {
                      publishMessage(ch, QUEUE, node, key, "Fail");
                    }
                  };

                  pm.stopByUid(node, RUN_CODE);

                  pm.start(
                    "install.sh",
                    {
                      uid: node,
                      command: "bash",
                      max: 1,
                      killTree: true,
                      env: {
                        SOURCE_DIRECTORY: "/twain/code",
                        MODEL_DIRECTORY: "/twain/model"
                      },
                      cwd: `${__dirname}/test_samples/source/${node}`
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
