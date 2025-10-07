;; Crypto Pong Battle - Betting Contract
;; Manages STX wagers on battle outcomes and automated payouts.

;; Constants
(define-constant ERR-UNAUTHORIZED (err u100))
(define-constant ERR-BATTLE-ENDED (err u101))
(define-constant ERR-BET-ALREADY-PLACED (err u102))
(define-constant ERR-INVALID-BET-AMOUNT (err u103))
(define-constant ERR-NO-WINNER (err u104))
(define-constant FEE-PERCENTAGE u100)
(define-constant MIN-BET u1000000)
(define-constant CONTRACT-OWNER tx-sender)

;; Data Maps
(define-map bet-pools uint {
    coin-a-principal: principal,
    coin-b-principal: principal,
    coin-a-amount: uint,
    coin-b-amount: uint,
    winner-principal: (optional principal)
})

(define-data-var next-pool-id uint u1)

;; Helper Functions
(define-private (get-next-pool-id)
    (let ((current-id (var-get next-pool-id)))
        (var-set next-pool-id (+ current-id u1))
        current-id
    )
)

(define-private (calculate-fee (amount uint))
    (/ (* amount FEE-PERCENTAGE) u10000)
)

;; Public Functions
(define-public (place-bet
    (amount uint)
    (coin-choice-a bool)
)
    (begin
        (asserts! (>= amount MIN-BET) ERR-INVALID-BET-AMOUNT)

        (let
            (
                (pool-id (get-next-pool-id))
                (sender tx-sender)
            )

            (try! (stx-transfer? amount sender (as-contract tx-sender)))

            (if coin-choice-a
                (map-set bet-pools pool-id
                    {
                        coin-a-principal: sender,
                        coin-b-principal: sender,
                        coin-a-amount: amount,
                        coin-b-amount: u0,
                        winner-principal: none
                    }
                )
                (map-set bet-pools pool-id
                    {
                        coin-a-principal: sender,
                        coin-b-principal: sender,
                        coin-a-amount: u0,
                        coin-b-amount: amount,
                        winner-principal: none
                    }
                )
            )

            (ok pool-id)
        )
    )
)

(define-public (join-bet (pool-id uint) (amount uint))
    (let
        (
            (sender tx-sender)
            (current-pool (unwrap! (map-get? bet-pools pool-id) ERR-BATTLE-ENDED))
            (first-bettor (get coin-a-principal current-pool))
            (first-bet-amount (get coin-a-amount current-pool))
        )
        (asserts! (not (is-eq sender first-bettor)) ERR-BET-ALREADY-PLACED)
        (asserts! (is-none (get winner-principal current-pool)) ERR-BATTLE-ENDED)
        (asserts! (is-eq amount first-bet-amount) ERR-INVALID-BET-AMOUNT)

        (try! (stx-transfer? amount sender (as-contract tx-sender)))

        (map-set bet-pools pool-id
            (merge current-pool
                {
                    coin-b-principal: sender,
                    coin-b-amount: amount
                }
            )
        )
        (ok true)
    )
)

(define-public (process-payout (pool-id uint) (winning-coin-principal principal))
    (let
        (
            (pool (unwrap! (map-get? bet-pools pool-id) ERR-BATTLE-ENDED))
            (total-wager (+ (get coin-a-amount pool) (get coin-b-amount pool)))
            (fee (calculate-fee total-wager))
            (payout (- total-wager fee))
        )

        (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)

        (map-set bet-pools pool-id
            (merge pool
                { winner-principal: (some winning-coin-principal) }
            )
        )

        (try! (as-contract (stx-transfer? payout tx-sender winning-coin-principal)))
        (try! (as-contract (stx-transfer? fee tx-sender CONTRACT-OWNER)))

        (ok winning-coin-principal)
    )
)

;; Read-Only Functions
(define-read-only (get-pool (pool-id uint))
    (map-get? bet-pools pool-id)
)

(define-read-only (get-next-pool)
    (ok (var-get next-pool-id))
)