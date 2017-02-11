'use strict';

class Location {
  constructor(buf) {
    this._indexes = [];

    let index = -1;

    while ((index = buf.indexOf('\n', index + 1)) !== -1) {
      this._indexes.push(index);
    }
  }

  /**
   * Get line number.
   *
   * @param {number} index - the 0-based index.
   * @return {number} Returns 0-based line number for given index.
   */
  getLine(index) {
    if (!Number.isInteger(index)) {
      throw new TypeError('First argument must be a number.');
    }

    for (let i = 0; i < this._indexes.length; i++) {
      if (index <= this._indexes[i]) return i;
    }

    return this._indexes.length;
  }
}

module.exports = Location;
