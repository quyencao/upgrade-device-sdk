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

              switch (command) {
                case DEPLOY_MODEL:
                  console.log("command", command);

                  pm.stopByUid(node, DEPLOY_MODEL);

                  const onExitRunInDeployModel = function(code) {
                    if (code !== 0) {
                      publishMessage(ch, command, QUEUE, node, key, -1);
                    }
                  };

                  const onExitInstallInDeployModel = function(code) {
                    console.log("on exit install from outside", code);

                    if (code === 0) {
                      // publishMessage(ch, command, QUEUE, node, key, 0);

                      pm.start(
                        "twain.py",
                        {
                          uid: node,
                          command: "python",
                          max: 1,
                          killTree: true,
                          env: {
                            SOURCE_DIRECTORY: `${BASE_SOURCE_DIRECTORY}/${node}`,
                            MODEL_DIRECTORY: `${BASE_MODEL_DIRECTORY}/${node}`
                          },
                          cwd: `${BASE_SOURCE_DIRECTORY}/${node}`
                        },
                        RUN_CODE,
                        { onExit: onExitRunInDeployModel }
                      );
                    } else {
                      publishMessage(ch, command, QUEUE, node, key, -1);
                    }
                  };

                  const onExitDownloadModel = function(code) {
                    console.log("on exit download model from outside", code);

                    if (code === 0) {
                      publishMessage(ch, command, QUEUE, node, key, 0);

                      pm.stopByUid(node, RUN_CODE);

                      mkdirp.sync(`${BASE_SOURCE_DIRECTORY}/${node}`);
                      mkdirp.sync(`${BASE_MODEL_DIRECTORY}/${node}`);

                      pm.start(
                        "install.sh",
                        {
                          uid: node,
                          command: "bash",
                          max: 1,
                          killTree: true,
                          env: {
                            SOURCE_DIRECTORY: `${BASE_SOURCE_DIRECTORY}/${node}`,
                            MODEL_DIRECTORY: `${BASE_MODEL_DIRECTORY}/${node}`
                          },
                          cwd: `${BASE_SOURCE_DIRECTORY}/${node}`
                        },
                        RUN_CODE,
                        { onExit: onExitInstallInDeployModel }
                      );

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
                        directory: `${BASE_MODEL_DIRECTORY}/${node}`,
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

                  const onExitRunInDeploySource = function(code) {
                    if (code !== 0) {
                      publishMessage(ch, command, QUEUE, node, key, -1);
                    }
                  };

                  const onExitInstallInDeploySource = function(code) {
                    console.log("on exit install from outside", code);

                    if (code === 0) {
                      // publishMessage(ch, command, QUEUE, node, key, 0);

                      pm.start(
                        "twain.py",
                        {
                          uid: node,
                          command: "python",
                          max: 1,
                          killTree: true,
                          env: {
                            SOURCE_DIRECTORY: `${BASE_SOURCE_DIRECTORY}/${node}`,
                            MODEL_DIRECTORY: `${BASE_MODEL_DIRECTORY}/${node}`
                          },
                          cwd: `${BASE_SOURCE_DIRECTORY}/${node}`
                        },
                        RUN_CODE,
                        { onExit: onExitRunInDeploySource }
                      );
                    } else {
                      publishMessage(ch, command, QUEUE, node, key, -1);
                    }
                  };

                  const onExitDownloadSource = function(code) {
                    console.log("on exit download source from outside", code);

                    if (code === 0) {
                      publishMessage(ch, command, QUEUE, node, key, 0);

                      pm.stopByUid(node, RUN_CODE);

                      mkdirp.sync(`${BASE_SOURCE_DIRECTORY}/${node}`);
                      mkdirp.sync(`${BASE_MODEL_DIRECTORY}/${node}`);

                      pm.start(
                        "install.sh",
                        {
                          uid: node,
                          command: "bash",
                          max: 1,
                          killTree: true,
                          env: {
                            SOURCE_DIRECTORY: `${BASE_SOURCE_DIRECTORY}/${node}`,
                            MODEL_DIRECTORY: `${BASE_MODEL_DIRECTORY}/${node}`
                          },
                          cwd: `${BASE_SOURCE_DIRECTORY}/${node}`
                        },
                        RUN_CODE,
                        { onExit: onExitInstallInDeploySource }
                      );

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
                        directory: `${BASE_SOURCE_DIRECTORY}/${node}`,
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
                          command: "python",
                          max: 1,
                          killTree: true,
                          env: {
                            SOURCE_DIRECTORY: `${BASE_SOURCE_DIRECTORY}/${node}`,
                            MODEL_DIRECTORY: `${BASE_MODEL_DIRECTORY}/${node}`
                          },
                          cwd: `${BASE_SOURCE_DIRECTORY}/${node}`
                        },
                        RUN_CODE,
                        { onExit: onExitRun }
                      );
                    } else {
                      publishMessage(ch, command, QUEUE, node, key, -1);
                    }
                  };

                  pm.stopByUid(node, RUN_CODE);
                  mkdirp.sync(`${BASE_SOURCE_DIRECTORY}/${node}`);
                  mkdirp.sync(`${BASE_MODEL_DIRECTORY}/${node}`);

                  pm.start(
                    "install.sh",
                    {
                      uid: node,
                      command: "bash",
                      max: 1,
                      killTree: true,
                      env: {
                        SOURCE_DIRECTORY: `${BASE_SOURCE_DIRECTORY}/${node}`,
                        MODEL_DIRECTORY: `${BASE_MODEL_DIRECTORY}/${node}`
                      },
                      cwd: `${BASE_SOURCE_DIRECTORY}/${node}`
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
