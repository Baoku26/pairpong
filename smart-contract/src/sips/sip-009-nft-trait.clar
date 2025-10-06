;; SIP-009 Trait Definition
;; Standard interface for Non-Fungible Tokens (NFTs) on Stacks.

(define-trait nft-trait
  (
    ;; Standard errors defined by the implementor contract
    (ERR-NOT-AUTHORIZED u100)
    (ERR-INVALID-ID u101)

    ;; --- Required Public Functions ---

    ;; @desc Transfers an NFT from sender to recipient.
    ;; @param token-id The unique ID of the token to transfer.
    ;; @param sender The current owner of the token.
    ;; @param recipient The principal receiving the token.
    (transfer (token-id uint) (sender principal) (recipient principal) (response bool uint))

    ;; @desc Returns the owner of the given token ID.
    ;; @param token-id The unique ID of the token.
    (get-owner (token-id uint) (response (optional principal) uint))

    ;; @desc Returns the URI for the token metadata (containing name, description, image, etc.).
    ;; @param token-id The unique ID of the token.
    (get-token-uri (token-id uint) (response (optional (string-ascii 256)) uint))

    ;; --- Optional Functions (Commonly Included) ---

    ;; @desc Returns the last token ID that has been minted.
    (get-last-token-id () (response uint uint))
  )
)
