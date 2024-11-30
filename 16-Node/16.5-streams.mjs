import { createReadStream, createWriteStream, readFile, writeFile } from "node:fs";
import { Stream } from "node:stream";
import * as zlib from "node:zlib";

//* and asynchronous but non streaming (and therefore inefficient) function
function copyFile(srcFileName, destinationFileName, callback) {
  readFile(srcFileName, (err, buffer) => {
    if (err) callback(err);
    writeFile(destinationFileName, buffer, callback);
  });
}

// copyFile("../package.json", "./copy.json", (res) => console.log("result copy file", res));

//* Streams algorithms are use to process data without allocating the entire data in memory, instead processing it in chunks

//* 16.5.1 PIPES
//* Pipes are use to transfer some data from a stream to another without the need to handle reading and writing

function pipe(readable, writable, callback) {
  function handleError(err) {
    readable.close();
    writable.close();
    callback(err);
  }

  // define the pipe and handle the normal termination case
  readable.on("error", handleError).pipe(writable).on("error", handleError).on("finish", callback);
}

//* function that compress a file
function gzip(filename, callback) {
  // create streams
  let source = createReadStream(filename);
  let destination = createWriteStream(filename + ".gz");
  let gzipper = zlib.createGzip();

  // set up the pipeline
  source
    .on("error", callback)
    .pipe(gzipper)
    .pipe(destination)
    .on("error", callback)
    .on("finish", callback);
}

// gzip("./copy.json", (res) => console.log("res gzip file", res));

//* One way to precess data as it streams through the program is with Transforms to avoid manually reading and writing the streams
//* This function works like UNIX grep utility: it reads lines of text from and input stream, but writes only the lines that match a regular expression

class GrepStream extends Stream.Transform {
  constructor(pattern) {
    super({ decodeStrings: false });
    this.pattern = pattern;
    this.incompleteLine = "";
  }

  _transform(chunk, encoding, callback) {
    if (typeof chunk !== "string") {
      callback(new Error("Expected a string but got a buffer"));
      return;
    }

    // add the chuck to any previously incomplete line and break everything into lines
    let lines = (this.incompleteLine + chunk).split("\n");

    // the last element of the array is the new incomplete line
    this.incompleteLine = lines.pop();

    // find all matching lines
    let output = lines.filter((line) => this.pattern.test(line)).join("\n");

    // if anything matched, add a final newline
    if (output) {
      output + "\n";
    }

    callback(null, output);
  }

  // this is called right before the stream is closed. Chance to write any last data
  _flush(callback) {
    // if we still have an incomplete line, and it matches, pass it to the callback
    if (this.pattern.test(this.incompleteLine)) {
      callback(null, this.incompleteLine + "\n");
    }
  }
}

let pattern = new RegExp(process.argv[2]);
console.log(process.argv[2]);

process.stdin
  .setEncoding("utf8")
  .pipe(new GrepStream(pattern))
  .pipe(process.stdout)
  .on("error", (e) => {
    console.error("grep stream error", e);
    process.exit();
  });
