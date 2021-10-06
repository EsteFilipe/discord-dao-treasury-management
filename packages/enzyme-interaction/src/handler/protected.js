// TODO: Fetch the from the subgraph instead of hardcoding
const ADDRESSES = {
  WETH: { address: "0xd0a1e359811322d97991e03f863a0c30c2cf029c", decimals: 18 },
  BAT: { address: "0x2e62eaaf0f490219be8ed376326e0516228bae89", decimals: 18 },
  BNB: { address: "0x4674e9587925f9fb4d3a4cc5591029596280e00c", decimals: 18 },
  SNX: { address: "0x4c22d46c07ab880f94e8213e0256727af471a9f4", decimals: 18 },
  UNI: { address: "0x86684577af5598b229a27c5774b658d303e2e044", decimals: 18 },
  USDT: { address: "0x50e7615a526f715556c478749303c75571f1e6b5", decimals: 6 },
};

exports.executeTrade = async (event, context) => {
  console.log("executed");
  console.log(event);
};
