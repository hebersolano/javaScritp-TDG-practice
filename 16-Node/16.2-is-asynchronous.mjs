import { readFile } from "node:fs";
import { readFile as readFileP } from "node:fs/promises";

function readConfigFile(path, callback) {
  readFile(path, "utf8", (error, text) => {
    if (error) {
      console.error("reading config file error", error);
      callback(null);
      return;
    }

    let data = null;
    try {
      data = JSON.parse(text);
    } catch (error) {
      console.error("error parsing data", error);
    }

    callback(data);
  });
}

// readConfigFile("../../package.json", (res) => console.log("callback response", res));

function readConfigFilePromise(path) {
  return readFileP(path, "utf8")
    .then((text) => JSON.parse(text))
    .catch((error) => console.error("error reading config file", error));
}

readConfigFilePromise("../../package.json").then((res) =>
  console.log("res read file promise", res)
);
