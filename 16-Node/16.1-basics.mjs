//* command-line arguments
// console.log("command-line arguments", process.argv);

//* environment variables
// console.log("environment variables", process.env);

// process.exit();

//* Handle global rejections
process.setUncaughtExceptionCaptureCallback((e) => {
  console.error("Uncaught Exception", e);
});

process.on("unhandledRejection", (error, promise) => {
  console.error("Promise rejection", error);
  console.log(promise);
});
