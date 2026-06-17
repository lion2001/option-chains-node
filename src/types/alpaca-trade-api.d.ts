declare module "@alpacahq/alpaca-trade-api" {
  interface AlpacaClientConfig {
    keyId: string;
    secretKey: string;
    paper?: boolean;
  }

  export default class Alpaca {
    constructor(config: AlpacaClientConfig);
    getOptionChain(underlyingSymbol: string, options?: Record<string, unknown>): Promise<unknown[]>;
  }
}
