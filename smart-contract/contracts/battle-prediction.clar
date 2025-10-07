;; Crypto Pong Battle - Betting Contract
;; Manages single-player STX predictions on battle outcomes and automated payouts.

;; Constants
(define-constant ERR-UNAUTHORIZED (err u100))
(define-constant ERR-BET-ALREADY-SETTLED (err u101))
(define-constant ERR-INVALID-BET-AMOUNT (err u103))
(define-constant ERR-INVALID-BET-ID (err u104))
(define-constant FEE-PERCENTAGE u100)           ;; 1% fee (100 basis points)
(define-constant PAYOUT-MULTIPLIER u200)        ;; 2x return (100% profit)
(define-constant MIN-BET u1000000)              ;; Minimum bet of 1 STX
(define-constant CONTRACT-OWNER tx-sender)

;; Data Maps
;; Tracks individual predictions made by users.
(define-map bets uint {
    bettor: principal,
    amount: uint,
    predicted-winner-is-a: bool, ;; true if user bet on Coin A, false if user bet on Coin B
    is-settled: bool
})

(define-data-var next-bet-id uint u1)

;; Helper Functions
(define-private (get-next-bet-id)
    (let ((current-id (var-get next-bet-id)))
        (var-set next-bet-id (+ current-id u1))
        current-id
    )
)

;; Calculates the 1% fee on the initial wager.
(define-private (calculate-fee (amount uint))
    (/ (* amount FEE-PERCENTAGE) u10000)
)

;; --- Public Functions ---

;; @desc Places a wager and records the user's prediction (Coin A or B).
;; @param amount The STX amount to wager.
;; @param coin-choice-a True if betting on Coin A, False if betting on Coin B.
(define-public (place-bet
    (amount uint)
    (coin-choice-a bool)
)
    (begin
        (asserts! (>= amount MIN-BET) ERR-INVALID-BET-AMOUNT)

        (let
            (
                (bet-id (get-next-bet-id))
                (sender tx-sender)
            )

            ;; Transfer STX from sender to the contract (held as a wager)
            (try! (stx-transfer? amount sender (as-contract tx-sender)))

            ;; Record the prediction
            (map-set bets bet-id
                {
                    bettor: sender,
                    amount: amount,
                    predicted-winner-is-a: coin-choice-a,
                    is-settled: false
                }
            )

            ;; Return the unique bet ID for tracking
            (ok bet-id)
        )
    )
)

;; @desc Called by the contract owner (or trusted source) to settle the bet after the game.
;; @param bet-id The ID of the prediction to settle.
;; @param actual-winner-is-a True if Coin A won, False if Coin B won.
(define-public (process-payout (bet-id uint) (actual-winner-is-a bool))
    (let
        (
            (bet (unwrap! (map-get? bets bet-id) ERR-INVALID-BET-ID))
            (bettor (get bettor bet))
            (wager-amount (get amount bet))
            (prediction-was-a (get predicted-winner-is-a bet))
        )

        ;; 1. Check permissions and settlement status
        (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
        (asserts! (not (get is-settled bet)) ERR-BET-ALREADY-SETTLED)

        ;; 2. Determine if the prediction was correct
        (if (is-eq prediction-was-a actual-winner-is-a)
            ;; --- WIN SCENARIO ---
            (begin
                (let
                    (
                        ;; Payout is 2x the wager (wager + 100% profit)
                        (payout-amount (* wager-amount PAYOUT-MULTIPLIER)) 
                        (fee (calculate-fee wager-amount))
                        (total-return (- payout-amount fee))
                        (profit-for-owner (- payout-amount total-return)) ;; Should be equal to the fee
                    )
                    
                    ;; Pay the winner: total return (2x wager - fee)
                    (try! (as-contract (stx-transfer? total-return tx-sender bettor)))
                    
                    ;; Owner keeps the fee (1% of wager)
                    (try! (as-contract (stx-transfer? fee tx-sender CONTRACT-OWNER)))

                    (ok (print { event: "win", bettor: bettor, amount: total-return }))
                )
            )
            ;; --- LOSS SCENARIO ---
            (begin
                ;; User loses wager. Contract keeps the funds.
                ;; Total wager (wager-amount) remains in the contract's principal.
                (try! (as-contract (stx-transfer? wager-amount tx-sender CONTRACT-OWNER)))
                (ok (print { event: "loss", bettor: bettor, amount: u0 }))
            )
        )
        
        ;; 3. Mark the bet as settled regardless of outcome
        (map-set bets bet-id (merge bet { is-settled: true }))
        (ok true)
    )
)

;; --- Read-Only Functions ---

(define-read-only (get-bet (bet-id uint))
    (map-get? bets bet-id)
)

(define-read-only (get-next-bet-id-read-only)
    (ok (var-get next-bet-id))
)
