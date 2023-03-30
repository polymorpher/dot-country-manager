# 1.country domain manager

Tools for users to view, transfer, wrap, and unwrap their domains leased at 1.country. The terms "wrap" and "unwrap" refer to functions provided by [TLDNameWrapper](https://github.com/harmony-one/ens-deployer/blob/main/contract/contracts/TLDNameWrapper.sol). 

In layman terms, a "wrapped" domain is a ERC1155 NFT, whereas an "unwrapped" domain is a ERC721 NFT. By default, all domains are wrapped when leased and registered. Users should only unwrap their domain in rare use cases. For example, when they interact with an NFT marketplace that only supports ERC721, or when they work with some applications that only support legacy ENS domains through the BaseRegistrar (ERC721) contract.

## Contract Addresses

At this time, the production contracts deployed in Harmony mainnet shard 0 are:

- TLDNameWrapper: `0x4Cd2563118e57B19179d8DC033f2B0C5B5D69ff5`
- TLDBaseRegistrar: `0x4D64B78eAf6129FaC30aB51E6D2D679993Ea9dDD`
- PublicResolver: `0x46E37034Ffc87a969d1a581748Acf6a94Bc7415D`

## Developer Notes

The environment variables that need to be set (in .env) corresponding to those contracts are

```
VITE_NAME_WRAPPER_ADDRESS
VITE_BASE_REGISTRAR_ADDRESS
VITE_RESOLVER_ADDRESS
VITE_PROVIDER
VITE_WALLET_CONNECT_ID
VITE_CHAIN_ID
```

The `VITE_` prefix is required for the frontend framework to identify and load these variables. Example values of most variables are provided in `.env.example` 