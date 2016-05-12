'use strict'

function parseResult(text) {

  const nextLine = () => {
    const i = text.indexOf('\r\n');
    if (i === -1) {
      return null;
    } else {
      const line = text.slice(0, i);
      text = text.slice(i + 2);
      return line;
    }
  };

  const getLines = (n) => {
    const originText = text;
    const lines = [];
    const n2 = n * 2;
    for (let i = 0; i < n2; i++) {
      const line = nextLine();
      if (!line) break;
      lines.push(line);
    }
    if (lines.length === n2) {
      return lines;
    } else {
      text = originText;
      return null;
    }
  };

  let result = null;
  while (true) {

    const line = nextLine();
    if (!line) break;

    if (line[0] === '-') {
      result = {error: line.slice(1)};
      break;
    }

    if (line[0] === '+') {
      result = {data: line.slice(1)};
      break;
    }

    if (line[0] === '$') {
      const n = parseInt(line.slice(1), 10);
      if (isNaN(n)) {

        continue;

      } else if (n === -1) {

        result = {data: null};
        break;

      } else {

        const line2 = nextLine();
        if (line2) {
          result = {data: line2};
        }
        break;

      }
    }

    if (line[0] === '*') {
      const n = parseInt(line.slice(1), 10);
      if (isNaN(n)) {

        continue;

      } else if (n === -1) {

        result = {data: null};
        break;

      } else {

        const lines = getLines(n);
        if (lines) {
          result = {data: []};
          for (let i = 0; i < lines.length; i++) {
            if (i % 2 !== 0) {
              result.data.push(lines[i]);
            }
          }
          break;

        } else {
          break;
        }
      }
    }

  }

  if (result) {
    result.rest = text;
  }

  return result;

}

module.exports = parseResult;
