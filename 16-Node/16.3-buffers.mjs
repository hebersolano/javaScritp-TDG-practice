let b = Buffer.from([0x41, 0x42, 0x43]);
console.log(b.toString());
console.log(b.toString("hex"));

let computer = Buffer.from("IBM3111", "ascii");
for (let i = 0; i < computer.length; i++) {
  computer[1]--; // buffers are mutable
}
console.log(computer.toString("ascii"));

//* create a empty buffer
let zeros = Buffer.alloc(1024);
let ones = Buffer.alloc(128, 1);
console.log(ones);
