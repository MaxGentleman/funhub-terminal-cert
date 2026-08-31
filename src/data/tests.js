/* The six tests, with the instruction a manager reads before running one. */
export const TESTS = [
  {code:"AMEX-PAY", en:{n:"AMEX payment", s:"Make a small sale with an **American Express** card on this terminal.", d:"Run a small sale on the terminal with an American Express card. AMEX is disabled by default on some merchant accounts, so this is the one payment test that still has to be proven."},
   fr:{n:"Paiement AMEX", s:"Faites une petite vente avec une carte **American Express** sur ce terminal.", d:"Passez une petite vente sur le terminal avec une carte American Express. AMEX est désactivé par défaut sur certains comptes marchands — c'est le seul test de paiement qu'il faut encore prouver."}},
  {code:"INT-PAY", en:{n:"Integrated payment", s:"Start a small sale **in the POS software**. The amount must appear on the terminal by itself.", d:"Start the sale in the POS software, not on the terminal keypad. The amount must appear on the terminal by itself, and the approval must come back into the POS and close the order. This proves the POS and the terminal are actually talking."},
   fr:{n:"Paiement intégré", s:"Lancez une petite vente **dans le logiciel PDV**. Le montant doit apparaître seul sur le terminal.", d:"Lancez la vente depuis le logiciel PDV, pas sur le clavier du terminal. Le montant doit apparaître seul sur le terminal, et l'approbation doit revenir dans le PDV et clôturer la commande. C'est la preuve que le PDV et le terminal communiquent."}},
  {code:"DEBIT-REF", en:{n:"Debit refund", s:"Refund a sale that was paid by **debit**.", d:"Refund a debit sale on this terminal. The receipt must print REFUND / REMBOURSEMENT and the funds must leave the merchant account."},
   fr:{n:"Remboursement débit", s:"Remboursez une vente payée par **débit**.", d:"Remboursez une vente débit sur ce terminal. Le reçu doit imprimer REMBOURSEMENT et les fonds doivent sortir du compte marchand."}},
  {code:"VMC-REF", en:{n:"Visa / Mastercard refund", s:"Refund a sale that was paid by **Visa or Mastercard**.", d:"Refund a Visa or Mastercard sale on this terminal. Note which brand you used."},
   fr:{n:"Remboursement Visa / Mastercard", s:"Remboursez une vente payée par **Visa ou Mastercard**.", d:"Remboursez une vente Visa ou Mastercard sur ce terminal. Notez la marque utilisée."}},
  {code:"AMEX-REF", en:{n:"AMEX refund", s:"Refund a sale that was paid by **American Express**.", d:"Refund an American Express sale. AMEX refunds can be blocked separately from AMEX payments, so test it on its own."},
   fr:{n:"Remboursement AMEX", s:"Remboursez une vente payée par **American Express**.", d:"Remboursez une vente American Express. Les remboursements AMEX peuvent être bloqués indépendamment des paiements AMEX — testez-les séparément."}},
  {code:"INT-REF", en:{n:"Integrated refund", s:"Refund **from the POS software**, not on the terminal keypad.", d:"Launch the refund from the POS software (Midori, Embed, Cluster, MYR, Intercard) instead of typing it on the terminal. The terminal must respond on its own and the POS must record the refund against the original order."},
   fr:{n:"Remboursement intégré", s:"Remboursez **depuis le logiciel PDV**, pas sur le clavier du terminal.", d:"Lancez le remboursement depuis le logiciel PDV (Midori, Embed, Cluster, MYR, Intercard) plutôt que sur le terminal. Le terminal doit répondre seul et le PDV doit enregistrer le remboursement sur la commande d'origine."}}
];
/* ------------------------------------------------------- procedures ------
   Inline markup used in the step strings:
     **bold**      the action, or the thing people get wrong
     [[Label]]     something written on the screen - a button, tab, field or
                   message - rendered in quotes so it is unmistakable
   Keys: "model:<terminal model>|MANUAL-REF"  -> DEBIT-REF / VMC-REF / AMEX-REF
         "pos:<POS name>|INT-REF"             -> the integrated refund       */
