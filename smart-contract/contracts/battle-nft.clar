;; Crypto Pong Battle - NFT Contract (SIP-009)
;; Defines and manages the Battle Victory NFT.

(use-trait nft-trait 'SP2PABAF9E7KEKAJ2SSPCK7S4Q8CCQJADSE92G7M.sip-009-nft-trait.nft-trait)

;; --- Constants ---
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant CONTRACT-TREASURY 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM) 
;; Placeholder address for NFT treasury

;; --- NFT Definition ---

(define-non-fungible-token battle-victory-nft uint)

;; Tracks the next available NFT ID
(define-data-var next-nft-id uint u1)

;; Stores the metadata URI for each token ID
(define-map token-uri uint (string-ascii 256))

;; --- Trait Implementation (SIP-009) ---

(define-read-only (get-last-token-id)
    (ok (var-get next-nft-id))
)

(define-read-only (get-token-uri (token-id uint))
    (ok (map-get? token-uri token-id))
)

(define-read-only (get-owner (token-id uint))
    (ok (nft-get-owner battle-victory-nft token-id))
)

(define-public (transfer (token-id uint) (sender principal) (recipient principal))
    (begin
        (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
        (nft-transfer? battle-victory-nft token-id sender recipient)
    )
)

;; --- Minting Logic ---

;; @desc Mints a new NFT to the recipient, restricted to the Leaderboard contract or deployer.
;; @param recipient The principal to receive the NFT.
;; @param metadata-uri The URI pointing to the token metadata.
(define-public (mint-battle-nft
    (recipient principal)
    (metadata-uri (string-ascii 256))
)
    (let
        (
        (current-id (var-get next-nft-id))
        ;; Only the deployer or the specific leaderboard contract can mint
        (is-caller-valid (or (is-eq tx-sender CONTRACT-OWNER) (is-eq tx-sender 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.battle-leaderboard)))
        )
        (asserts! is-caller-valid ERR-NOT-AUTHORIZED)

        (try! (nft-mint? battle-victory-nft current-id recipient))
        (map-set token-uri current-id metadata-uri)
        (var-set next-nft-id (+ current-id u1))

        (ok current-id)
    )
)