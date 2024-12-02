import * as os from "node:os";

console.log(process.cpuUsage());
console.log(process.getuid());
console.log(process.platform);

// console.log(os.constants);
console.log(os.freemem());
// console.log(os.networkInterfaces());
console.log(os.userInfo());
