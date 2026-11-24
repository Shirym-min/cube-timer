export const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
export const yPerm = "F R U' R' U' R U R' F' R U R' U' R' F R F'";
export const opParity = "R U' R' U' R U R D R' U' R D' R' U2 R' U'";
export const m2Parity = "U' F2 U M2 U' F2 U";

export const opEdgeSetups: Record<string, string> = {
  A: "Lw2 D' L2", C: "Lw2 D L2", D: "", E: "L Dw' L", F: "Dw' L", G: "L Dw L'",
  H: "Dw L'", I: "Lw D' L2", J: "Dw2 L", K: "Lw D L2", L: "L'", N: "Dw L",
  O: "D Lw' D' L2", P: "Dw' L'", Q: "Lw' D L2", R: "L", S: "Lw' D' L2",
  T: "Dw2 L'", U: "D' L2", V: "D2 L2", W: "D L2", X: "L2",
};

export const opCornerSetups: Record<string, string> = {
  B: "R D' F'", C: "", D: "F R' F'", F: "F", G: "D R", H: "D2 F'",
  I: "F2 R", J: "F R", K: "R", L: "D F'", M: "R' F'", N: "R2 F'",
  O: "D' R", P: "F'", Q: "R'", S: "D2 R", T: "D' F'", U: "F2",
  V: "D R2", W: "R2", X: "D F2",
};

export const m2Setups: Record<string, string> = {
  A: "", B: "F U' F'", D: "F U F'", E: "B L' B'", F: "F U2 F'", G: "B L B'",
  H: "D B' D'", J: "U R U'", L: "U' L' U", M: "B' R B", N: "D B D'", O: "B' R' B",
  P: "F' U2 F", Q: "U B' R U' B", R: "U' L U", T: "U R' U'", V: "U R2 U'", X: "U' L2 U",
};

export const m2Special: Record<string, string> = {
  C: "U2 M' U2 M'", I: "D M' U R2 U' M U R2 U' D' M2",
  S: "M2 D U R2 U' M' U R2 U' M D'", W: "M U2 M U2",
};
export const m2Even: Record<string, string> = { C: "W", W: "C", I: "S", S: "I" };
