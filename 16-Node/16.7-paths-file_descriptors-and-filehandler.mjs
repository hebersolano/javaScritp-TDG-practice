import { fileURLToPath } from "node:url";
import * as path from "node:path";
import {
  close,
  closeSync,
  createReadStream,
  open,
  openSync,
  read,
  readFile,
  readFileSync,
  readSync,
} from "node:fs";
import { readFile as readFileP } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("filename: ", __dirname, __filename);

console.log("separator", path.sep);
let p = "src/pkg/test.js";
console.log(p);
console.log("file name", path.basename(p));
console.log("extension name", path.extname(p));
console.log("dir name", path.dirname(p));

// normalize() cleans up paths
console.log(path.normalize("a/b/c/../d/"));

// join segments
console.log(path.join("src", "pkg", "test.js"));

// resolve and returns an absolute part
console.log(path.resolve("test.js"));

//16.7.2 READING FILES
let buffer = readFileSync("copy.json");
let text = readFileSync("copy.json", "utf8"); // return text if encoding is passed;

// read the bytes of the file asynchronously
readFile("copy.json", (error, buffer) => {
  if (error) console.error("read file error", error);
  // the bytes of the file are in buffer
});

// readFileP("copy.json", "utf8")
//   .then((text) => console.log(text))
//   .catch((err) => console.error(err));

function printFile(filename, encoding = "utf8") {
  createReadStream(filename, encoding).pipe(process.stdout);
}
// printFile("copy.json", "utf8");

// low-level control over exactly what bytes to read from a file
// open("copy.json", (err, fileDescriptor) => {
//   if (err) return console.error("error opening file:", err);
//   try {
//     read(fileDescriptor, Buffer.alloc(30), 0, 10, 6, (err, bytesRead, buffer) => {
//       if (err) console.error("error reading file:", err);
//       // bytesRead is the number of bytes actually read
//       // buffer is the buffer that they bytes were read into
//       console.log("bytes read:", bytesRead);
//       console.log(buffer.toString());
//     });
//   } finally {
//     close(fileDescriptor);
//   }
// });

function readData(filename) {
  let fileDescriptor = openSync(filename);
  try {
    // read the file header
    let header = Buffer.alloc(12); // a 12 byte buffer
    readSync(fileDescriptor, header, 0, 12, 0);

    // verify the file's magic number
    let magic = header.readInt32LE(0);
    console.log("magic:", magic);
    if (magic !== 0xdadafeed) throw new Error("File is of wrong type");

    // get the offset and length of the data from the header
    let offset = header.readInt32LE(4);
    let length = header.readInt32LE(8);

    // and read those bytes from the file
    let data = Buffer.alloc(length);
    readSync(fileDescriptor, data, 0, length, offset);
    return data;
  } finally {
    closeSync(fileDescriptor);
  }
}

readData("copy.json.gz");
