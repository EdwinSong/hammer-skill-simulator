/**
 * Compute a CSS matrix3d() string that maps the four corners of a rectangle
 * (0,0)-(w,h) to an arbitrary target quadrilateral.
 *
 * src is ignored for the homography itself (the source is always a unit
 * rectangle), but the resulting matrix is scaled to the element size.
 */

function solve(A, b) {
  // Gaussian elimination for a 8x8 system.
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    }
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];

    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        A[k][j] -= factor * A[i][j];
      }
      b[k] -= factor * b[i];
    }
  }

  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += A[i][j] * x[j];
    x[i] = (b[i] - sum) / A[i][i];
  }
  return x;
}

function normalize3x3(H) {
  const scale = H[2][2] || 1;
  return H.map((row) => row.map((v) => v / scale));
}

export function computeHomography(srcQuad, dstQuad) {
  // srcQuad / dstQuad: [[x0,y0], [x1,y1], [x2,y2], [x3,y3]]
  // Order: top-left, top-right, bottom-right, bottom-left.
  const A = [];
  const b = [];

  for (let i = 0; i < 4; i++) {
    const [sx, sy] = srcQuad[i];
    const [dx, dy] = dstQuad[i];
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }

  const h = solve(A, b);
  // 3x3 homography matrix.
  return normalize3x3([
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1],
  ]);
}

export function matrix3dFromQuad(elementWidth, elementHeight, dstQuad) {
  const srcQuad = [
    [0, 0],
    [elementWidth, 0],
    [elementWidth, elementHeight],
    [0, elementHeight],
  ];

  const H = computeHomography(srcQuad, dstQuad);

  // Convert 3x3 homography to 4x4 matrix3d (column-major).
  const m = [
    H[0][0], H[1][0], 0, H[2][0],
    H[0][1], H[1][1], 0, H[2][1],
    0,       0,       1, 0,
    H[0][2], H[1][2], 0, H[2][2],
  ];

  return `matrix3d(${m.map((v) => v.toFixed(6)).join(', ')})`;
}
