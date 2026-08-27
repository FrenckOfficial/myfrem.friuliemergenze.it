const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get("userid");;

window.location.href = `https://account.friuliemergenze.it/?usp=${userId}`