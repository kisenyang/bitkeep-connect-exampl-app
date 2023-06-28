import { getWalletConnectConnector, Wallet } from "@rainbow-me/rainbowkit";
import type { Chain, WindowProvider } from "wagmi";
import type { Connector } from "wagmi/connectors";
import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
export type { Wallet } from "@rainbow-me/rainbowkit";

type InjectedConnectorOptions = {
  name?: string | ((detectedName: string | string[]) => string);
  shimDisconnect?: boolean;
};
type WalletConnectConnectorConfig = ConstructorParameters<
  typeof WalletConnectConnector
>[0];
interface BitKeepWalletOptions {
  projectId?: string;
  chains: Chain[];
  shimDisconnect?: boolean;
  walletConnectVersion?: "2";
  walletConnectOptions?: WalletConnectConnectorConfig["options"];
}
interface BitKeepWalletLegacyOptions {
  projectId?: string;
  chains: Chain[];
  walletConnectVersion: "1";
  walletConnectOptions?: WalletConnectConnectorConfig["options"];
}

type BitKeepConnectorOptions = Pick<InjectedConnectorOptions, "shimDisconnect">;

export function isAndroid(): boolean {
  return (
    typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)
  );
}

export async function getWalletConnectUri(
  connector: Connector,
  version: "1" | "2"
): Promise<string> {
  const provider = await connector.getProvider();
  return version === "2"
    ? new Promise<string>((resolve) => provider.once("display_uri", resolve))
    : provider.connector.uri;
}

class BitKeepConnector extends InjectedConnector {
  id: string;
  ready: boolean;
  provider?: WindowProvider;
  constructor({
    chains = [],
    options: options_,
  }: {
    chains?: Chain[];
    options?: BitKeepConnectorOptions;
  } = {}) {
    const options = {
      name: "BitKeep",
      ...options_,
    };
    super({ chains, options });

    this.id = "Bitkeep";
    this.ready =
      typeof window != "undefined" &&
      !!this.findProvider(((window as any).bitkeep as any)?.ethereum);
  }

  async getProvider() {
    if (typeof window !== "undefined") {
      // TODO: Fallback to `ethereum#initialized` event for async injection
      // https://github.com/BitKeep/detect-provider#synchronous-and-asynchronous-injection=
      this.provider = ((window as any).bitkeep as any)?.ethereum;
      // typeof window !== 'undefined'
      //   ? ((window as any).bitkeep as any)?.ethereum
      //   : undefined;
    }
    return this.provider;
  }
  getReady(ethereum: WindowProvider) {
    if (!ethereum || !ethereum.isBitKeep) return;
    // Brave tries to make itself look like BitKeep
    // Could also try RPC `web3_clientVersion` if following is unreliable
    if (ethereum.isBraveWallet && !ethereum._events && !ethereum._state) return;
    if (ethereum.isTokenPocket) return;
    if (ethereum.isTokenary) return;
    return ethereum;
  }
  findProvider(ethereum: WindowProvider) {
    if (ethereum?.providers) return ethereum.providers.find(this.getReady);
    return this.getReady(ethereum);
  }
}

export const bitKeepWallet = ({
  chains,
  projectId,
  walletConnectOptions,
  walletConnectVersion = "2",
  ...options
}: (BitKeepWalletLegacyOptions | BitKeepWalletOptions) &
  InjectedConnectorOptions): Wallet => {
  // Not using the explicit isBitKeep fn to check for bitKeep
  // so that users can continue to use the bitKeep button
  // to interact with wallets compatible with window.ethereum.
  // The connector's getProvider will instead favor the real bitKeep
  // in window.providers scenarios with multiple wallets injected.

  const isBitKeepInjected =
    typeof window !== "undefined" &&
    (window as any).bitkeep !== undefined &&
    ((window as any).bitkeep as any)?.ethereum !== undefined;

  // && isBitKeep(((window as any).bitkeep as any)?.ethereum);

  const shouldUseWalletConnect = !isBitKeepInjected;

  return {
    createConnector: () => {
      const connector = shouldUseWalletConnect
        ? getWalletConnectConnector({
            chains,
            options: walletConnectOptions,
            projectId,
            version: walletConnectVersion,
          })
        : new BitKeepConnector({
            chains,
            options,
          });

      const getUri = async () => {
        const uri = await getWalletConnectUri(connector, walletConnectVersion);

        return isAndroid()
          ? uri
          : `https://bkcode.vip?value=${encodeURIComponent(uri)}`;
      };

      return {
        connector,
        extension: {
          instructions: {
            learnMoreUrl: "https://study.bitkeep.com",
            steps: [
              {
                description:
                  "We recommend pinning BitKeep to your taskbar for quicker access to your wallet.",
                step: "install",
                title: "Install the BitKeep extension",
              },
              {
                description:
                  "Be sure to back up your wallet using a secure method. Never share your secret phrase with anyone.",
                step: "create",
                title: "Create or Import a Wallet",
              },
              {
                description:
                  "Once you set up your wallet, click below to refresh the browser and load up the extension.",
                step: "refresh",
                title: "Refresh your browser",
              },
            ],
          },
        },
        mobile: {
          getUri: shouldUseWalletConnect ? getUri : undefined,
        },
        qrCode: shouldUseWalletConnect
          ? {
              getUri: async () =>
                getWalletConnectUri(connector, walletConnectVersion),
              instructions: {
                learnMoreUrl: "https://study.bitkeep.com",
                steps: [
                  {
                    description:
                      "We recommend putting BitKeep on your home screen for quicker access.",
                    step: "install",
                    title: "Open the BitKeep app",
                  },
                  {
                    description:
                      "Be sure to back up your wallet using a secure method. Never share your secret phrase with anyone.",
                    step: "create",
                    title: "Create or Import a Wallet",
                  },
                  {
                    description:
                      "After you scan, a connection prompt will appear for you to connect your wallet.",
                    step: "scan",
                    title: "Tap the scan button",
                  },
                ],
              },
            }
          : undefined,
      };
    },
    downloadUrls: {
      android: "https://bitkeep.com/en/download?type=2",
      browserExtension:
        "https://chrome.google.com/webstore/detail/bitkeep-crypto-nft-wallet/jiidiaalihmmhddjgbnbgdfflelocpak",
      chrome:
        "https://chrome.google.com/webstore/detail/bitkeep-crypto-nft-wallet/jiidiaalihmmhddjgbnbgdfflelocpak",
      ios: "https://apps.apple.com/app/bitkeep/id1395301115",
      mobile: "https://bitkeep.com/en/download?type=2",
      qrCode: "https://bitkeep.com/en/download",
    },
    iconAccent: "#f6851a",
    iconBackground: "#fff",
    iconUrl: "https://bitkeep.com/favicon.ico",
    id: "bitKeep",
    installed: !shouldUseWalletConnect ? isBitKeepInjected : undefined,
    name: "BitKeep",
  };
};