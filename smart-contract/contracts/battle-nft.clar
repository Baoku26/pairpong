;; Crypto Pong Battle - NFT Contract (SIP-009)
;; Defines and manages the Battle Victory NFT.

(impl-trait .sip-009-nft-trait.nft-trait)

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u401))

;; NFT Definition
(define-non-fungible-token battle-victory-nft uint)

(define-data-var next-nft-id uint u1)

(define-map token-uri uint (string-ascii 256))

;; Trait Implementation (SIP-009)
(define-read-only (get-last-token-id)
    (ok (- (var-get next-nft-id) u1))
)

(define-read-only (get-token-uri (token-id uint))
    (ok (map-get? token-uri token-id))
)

(define-read-only (get-owner (token-id uint))
    (ok (nft-get-owner? battle-victory-nft token-id))
)

(define-public (transfer (token-id uint) (sender principal) (recipient principal))
    (begin
        (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
        (nft-transfer? battle-victory-nft token-id sender recipient)
    )
)

;; Minting Logic
(define-public (mint-battle-nft
    (recipient principal)
    (metadata-uri (string-ascii 256))
)
    (let
        (
            (current-id (var-get next-nft-id))
            (is-caller-valid (is-eq tx-sender CONTRACT-OWNER))
        )
        (asserts! is-caller-valid ERR-NOT-AUTHORIZED)

        (try! (nft-mint? battle-victory-nft current-id recipient))
        (map-set token-uri current-id metadata-uri)
        (var-set next-nft-id (+ current-id u1))

        (ok current-id)
    )
)