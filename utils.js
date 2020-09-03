const fs = require("fs");
const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
const { PUBLISH_QUEUE, CONFIG_FILE } = require("./config");

const publishMessage = function(channel, command, device, node, key, status) {
  channel.publish(
    "",
    PUBLISH_QUEUE,
    Buffer.from(
      `{ "command": "${command}", "device": "${device}", "node": "${node}", "key": "${key}", "status": ${status} }`,
      "utf8"
    )
  );
};

const readFileSync = function(file, options) {
  options = options || {};

  try {
    let content = fs.readFileSync(file, options);
    return JSON.parse(content, options.reviver);
  } catch (err) {
    return null;
  }
};

const validateConfig = function() {
  const schema = {
    type: "object",
    properties: {
      code: {
        type: "string"
      },
      host: {
        type: "string"
      },
      port: {
        type: "number"
      },
      source_directory: {
        type: "string"
      },
      model_directory: {
        type: "string"
      }
    },
    required: ["code", "host", "port"]
  };

  const validate = ajv.compile(schema);
  const config = readFileSync(CONFIG_FILE);

  return [validate(config), config];
};

module.exports = {
  publishMessage,
  validateConfig
};
