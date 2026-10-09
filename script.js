
const loveButton = document.getElementById("loveButton");
const surprise = document.getElementById("surprise");

loveButton.addEventListener("click", function () {
    surprise.hidden = !surprise.hidden;

    if (surprise.hidden) {
        loveButton.textContent = "Нажми сюда ❤️";
    } else {
        loveButton.textContent = "Ещё раз 💗";
        createHearts(20);
    }
});

function createHearts(count) {
    for (let i = 0; i < count; i++) {
        const heart = document.createElement("span");

        heart.className = "heart";
        heart.textContent = ["❤️", "💗", "💕", "💖"][
            Math.floor(Math.random() * 4)
        ];

        heart.style.left = Math.random() * 100 + "vw";
        heart.style.fontSize = (18 + Math.random() * 20) + "px";
        heart.style.animationDuration = (3 + Math.random() * 3) + "s";

        document.body.appendChild(heart);

        heart.addEventListener("animationend", function () {
            heart.remove();
        });
    }
}

setInterval(function () {
    createHearts(1);
}, 900);