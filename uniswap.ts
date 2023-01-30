// import { ethers } from "ethers";
//convert all imports to require
// const { Route } = require("@uniswap/v3-sdk")
// const { Trade } = require("@uniswap/v3-sdk")
//  const ethers = require("ethers");
// const { Pool } = require("@uniswap/v3-sdk")
// const { CurrencyAmount, MaxUint256, Token, TradeType } = require('@uniswap/sdk-core');

import Web3 from "web3";
import BigNumber from "bignumber.js";

import { ethers } from "ethers";
import { Pool } from "@uniswap/v3-sdk";
import {
  CurrencyAmount,
  MaxUint256,
  Token,
  TradeType,
} from "@uniswap/sdk-core";
import { Route } from "@uniswap/v3-sdk";
import { Trade } from "@uniswap/v3-sdk";

import { abi as IUniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";
import { abi as QuoterABI } from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json";

const provider = new ethers.providers.JsonRpcProvider(
  "https://mainnet.infura.io/v3/269e68ee0f9c41c283017f6764ca2816"
);
// USDC-WETH pool address on mainnet for fee tier 0.05%
const poolAddress = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";

import abis from "./abis";
const { mainnet: addresses } = require("./addresses");
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    "https://mainnet.infura.io/v3/269e68ee0f9c41c283017f6764ca2816"
  )
);

let renderCount = 0;
const poolContract = new ethers.Contract(
  poolAddress,
  IUniswapV3PoolABI,
  provider
);

const quoterAddress = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

const quoterContract = new ethers.Contract(quoterAddress, QuoterABI, provider);

interface Immutables {
  factory: string;
  token0: string;
  token1: string;
  fee: number;
  tickSpacing: number;
  maxLiquidityPerTick: ethers.BigNumber;
}

interface State {
  liquidity: ethers.BigNumber;
  sqrtPriceX96: ethers.BigNumber;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
  unlocked: boolean;
}

async function getPoolImmutables() {
  const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] =
    await Promise.all([
      poolContract.factory(),
      poolContract.token0(),
      poolContract.token1(),
      poolContract.fee(),
      poolContract.tickSpacing(),
      poolContract.maxLiquidityPerTick(),
    ]);

  const immutables: Immutables = {
    factory,
    token0,
    token1,
    fee,
    tickSpacing,
    maxLiquidityPerTick,
  };
  return immutables;
}

async function getPoolState() {
  // note that data here can be desynced if the call executes over the span of two or more blocks.
  const [liquidity, slot] = await Promise.all([
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  const PoolState: State = {
    liquidity,
    sqrtPriceX96: slot[0],
    tick: slot[1],
    observationIndex: slot[2],
    observationCardinality: slot[3],
    observationCardinalityNext: slot[4],
    feeProtocol: slot[5],
    unlocked: slot[6],
  };

  return PoolState;
}

export default async function Uniswap_Price(): Promise<number> {
  console.log({ render: ++renderCount });
  const add = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
  const sushi = new web3.eth.Contract(abis.sushi.sushi, add);

  const cake = "0xEfF92A263d31888d860bD50809A8D171709b7b1c";
  const pan = new web3.eth.Contract(abis.pancakeSwap.router, cake);

  // query the state and immutable variables of the pool
  const [immutables, state] = await Promise.all([
    getPoolImmutables(),
    getPoolState(),
  ]);

  // create instances of the Token object to represent the two tokens in the given pool
  const TokenA = new Token(3, immutables.token0, 6, "USDC", "USD Coin");
  const TokenB = new Token(3, immutables.token1, 18, "WETH", "Wrapped Ether");

  const amountin = 5000 * 1e6;
  const quotedAmountOut2 =
    await quoterContract.callStatic.quoteExactInputSingle(
      immutables.token0,
      immutables.token1,
      immutables.fee,
      amountin.toString(),
      0
    );
  let Unibuy = quotedAmountOut2;
  Unibuy = Unibuy / 1e18;

  let panBuy = await pan.methods
    .getAmountsOut(5000000000, [
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    ])
    .call();
  let panbuy = panBuy[1] / 1e18;

  let sushiBuy = await sushi.methods
    .getAmountsOut(5000000000, [
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    ])
    .call();
  let sushibuy = sushiBuy[1] / 1e18;

  console.log("Uni BUY Amount  : " + Unibuy.toString());
  console.log("Sushi BUY Amount: " + sushibuy);
  console.log("Pan BUY Amount:   " + panbuy);

  console.log("_______________________________________________________\n");

  const SUniSell = await quoterContract.callStatic.quoteExactInputSingle(
    immutables.token1,
    immutables.token0,
    immutables.fee,
    sushiBuy[1].toString(),
    0
  );
  const PUniSell = await quoterContract.callStatic.quoteExactInputSingle(
    immutables.token1,
    immutables.token0,
    immutables.fee,
    panBuy[1].toString(),
    0
  );

  let ams = Unibuy * 1e18;
  const am = new BigNumber(ams);

  let UsushiSell = await sushi.methods
    .getAmountsOut(am, [
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    ])
    .call();
  let Usushisell = UsushiSell[1] / 1e6;
  console.log("Buy UNI****Sushi Sell Amount: " + Usushisell);

  let UpanSell = await pan.methods
    .getAmountsOut(am, [
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    ])
    .call();
  let Upansell = UpanSell[1] / 1e6;
  console.log("Buy UNI****Pancake Sell Amount: " + Upansell);

  let ams2 = sushibuy * 1e18;
  const am2 = new BigNumber(ams2);

  let SpanSell = await pan.methods
    .getAmountsOut(am2, [
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    ])
    .call();
  let Spansell = SpanSell[1] / 1e6;
  console.log("Buy Sushi****Pancake Sell Amount: " + Spansell);

  let SUnisell = SUniSell / 1e6;
  console.log("Buy Sushi****Uni Sell Amount: " + SUnisell);

  let ams3 = panbuy * 1e18;
  const am3 = new BigNumber(ams3);

  let PsushiSell = await pan.methods
    .getAmountsOut(am3, [
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    ])
    .call();
  let Psushisell = PsushiSell[1] / 1e6;
  console.log("Buy Pancake****Sushi Sell Amount: " + Psushisell);

  let PUnisell = PUniSell / 1e6;
  console.log("Buy Pancake****Uni Sell Amount: " + PUnisell);

  console.log("_______________________________________________________\n");

  if (
    Usushisell > 5000 ||
    Upansell > 5000 ||
    Spansell > 5000 ||
    SUnisell > 5000 ||
    Psushisell > 5000 ||
    PUnisell > 5000
  ) {
    console.log(
      "FOUNDHDGHG*****@&%~!#&!@&^#%^!@&%#&^!@%##########@@@@@@@@@@@@@@@@@@@@@##################\n"
    );
  }
  console.log("\n____________________Function Ended_____________________\n");
  return Unibuy.toString();
}
setInterval(Uniswap_Price, 5000);
