function sleep(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

async function test() {
    for (let i = 0; i < 100; i++) {
	await sleep(100);
    }
}
