// const nick = prompt("Enter your nickname");

const input = document.querySelector("#input");
const sentBtn = document.querySelector("#sent");

const chat = new EventSource("/chat");
chat.addEventListener("chat", (e) => {
  let div = document.createElement("div");
  div.append(e.data);
  input.before(div);
  input.scrollIntoView();
});

sentBtn.addEventListener("click", (e) => {
  console.log("on change input");
  fetch("/chat", {
    method: "POST",
    body: nick + ": " + e.target.value,
  })
    .then((res) => console.log("sent input response", res))
    .catch((err) => console.error("sent input error", err));

  input.value = "";
});
