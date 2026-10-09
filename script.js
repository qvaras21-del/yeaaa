
const restartButton = document.getElementById("restart");
const animation = document.getElementById("animation");
const loveText = document.getElementById("loveText");
const heart = document.getElementById("heart");
const message = document.getElementById("message");

restartButton.addEventListener("click", () => {
    loveText.style.animation = "none";
    heart.style.animation = "none";
    message.style.animation = "none";

    void animation.offsetWidth;

    loveText.style.animation = "";
    heart.style.animation = "";
    message.style.animation = "";
});
