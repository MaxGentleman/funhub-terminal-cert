import { FOLDER } from "../config.js";

export const PROCS = {
"manual:Clover|MANUAL-REF":{
 warn_en:"Use this **only when the POS refund will not go through**. On Clover, key the amount **before tax** - the terminal adds the tax on top. Every other terminal wants the tax-included total, so this one is easy to get wrong.",
 warn_fr:"À utiliser **seulement si le remboursement par le PDV ne passe pas**. Sur Clover, tapez le montant **avant taxes** - le terminal ajoute les taxes par-dessus. Tous les autres terminaux veulent le total taxes incluses : c'est l'erreur facile à faire ici.",
 en:["The terminal normally sits on the customer display. **Put four fingers in the four corners of the screen** at once - a PIN pad appears.",
     "**Type your manager PIN.**",
     "Open the [[Remboursement / Refund]] app.",
     "**Key the refund amount BEFORE tax.** The terminal adds the tax itself - if you key the tax-included total you will refund too much. There is no lookup of the original sale, so take the pre-tax amount off the customer's receipt.",
     "Press [[Effectuer un remboursement]].",
     "The customer **taps or inserts their card** on the terminal.",
     "The refund is approved and **the receipt prints**.",
     "Go back to the home screen and reopen the [[Clover Cloud Display]] app, so the terminal is ready for the next customer."],
 fr:["Le terminal affiche normalement l'écran client. **Posez quatre doigts dans les quatre coins de l'écran** en même temps - un clavier de NIP apparaît.",
     "**Tapez votre NIP de gestionnaire.**",
     "Ouvrez l'application [[Remboursement / Refund]].",
     "**Tapez le montant du remboursement AVANT taxes.** Le terminal ajoute les taxes lui-même - si vous tapez le total taxes incluses, vous rembourserez trop. Aucune recherche de la vente d'origine : prenez le montant avant taxes sur le reçu du client.",
     "Appuyez sur [[Effectuer un remboursement]].",
     "Le client **présente ou insère sa carte** sur le terminal.",
     "Le remboursement est approuvé et **le reçu s'imprime**.",
     "Revenez à l'écran d'accueil et rouvrez l'application [[Clover Cloud Display]], pour que le terminal soit prêt pour le prochain client."]},

"manual:Moneris|MANUAL-REF":{
 warn_en:"Use this **only when the POS refund will not go through**. The amount is keyed blind - read it off the customer's receipt before you confirm.",
 warn_fr:"À utiliser **seulement si le remboursement par le PDV ne passe pas**. Le montant est saisi à l'aveugle - lisez-le sur le reçu du client avant de confirmer.",
 en:["Wake the terminal, then **swipe across the screen from left to right** and press [[Quitter]] (Exit) to leave the idle screen.",
     "On [[Sign in]], clear the [[Username]] field - it keeps whoever used it last - and type your own. Leave [[Remember me]] ticked, then tap [[Sign in]]. **No password is asked here.**",
     "The purchase screen opens, headed [[Achat]] with [[Entrez le montant de l'achat]].",
     "Tap the **three-dot menu at the top right** - **not** the hamburger at the top left - and choose [[Remboursement]].",
     "A password prompt appears: [[Veuillez entrer votre mot de passe pour accéder aux remboursements]]. Enter your password and tap [[OK]]. **This is the only password gate.**",
     "**Key the refund amount straight in.** There is no lookup of the original sale, and no tax breakdown - enter the **tax-inclusive total**.",
     "Press the **green check**.",
     "The screen reads [[Donnez le terminal à votre client]] - hand it over. The customer **taps, inserts or swipes**.",
     "The refund is approved and **the receipt prints**."],
 fr:["Réveillez le terminal, puis **glissez le doigt sur l'écran de gauche à droite** et appuyez sur [[Quitter]] pour sortir de l'écran de veille.",
     "À [[Sign in]], effacez le champ [[Username]] - il garde la dernière personne - et tapez le vôtre. Laissez [[Remember me]] coché, puis touchez [[Sign in]]. **Aucun mot de passe ici.**",
     "L'écran d'achat s'ouvre, intitulé [[Achat]] avec [[Entrez le montant de l'achat]].",
     "Touchez le **menu trois points en haut à droite** - **pas** le menu hamburger en haut à gauche - et choisissez [[Remboursement]].",
     "Une demande de mot de passe apparaît : [[Veuillez entrer votre mot de passe pour accéder aux remboursements]]. Entrez-le et touchez [[OK]]. **C'est la seule barrière.**",
     "**Tapez directement le montant du remboursement.** Aucune recherche de la vente d'origine, et pas de ventilation de taxes - entrez le **total taxes incluses**.",
     "Appuyez sur le **crochet vert**.",
     "L'écran affiche [[Donnez le terminal à votre client]] - remettez-le. Le client **présente, insère ou glisse** sa carte.",
     "Le remboursement est approuvé et **le reçu s'imprime**."]},

"pos:Intercard|INT-REF":{
 warn_en:"Intercard is a **hybrid**: the terminal is driven from the POS, but **you key the amount yourself** - nothing is pulled from the original sale. Read the amount off the customer's receipt and check it twice. There is no separate manual procedure on these terminals; this is it.",
 warn_fr:"Intercard est un **hybride** : le terminal est piloté par le PDV, mais **vous tapez le montant vous-même** - rien n'est repris de la vente d'origine. Lisez le montant sur le reçu du client et vérifiez-le deux fois. Il n'y a pas de procédure manuelle distincte sur ces terminaux : c'est celle-ci.",
 en:["Make sure you are **logged in as yourself**. If the till is on someone else's session, press [[Log Out]] and sign back in with your own [[User Name]] and [[Password]].",
     "On the sale screen, press [[Functions]] at the bottom left.",
     "On the [[Admin]] tab, press the gold [[Refunds]] button at the bottom left.",
     "In the dialog choose [[Credit Card Refund]] - **not** [[Cash Refund]].",
     "**Type the refund amount on the keypad.** Nothing is pulled from the original sale, so take the amount off the customer's receipt.",
     "Pick a [[Reason Code]]: [[Returned Merchandise]], [[Unhappy customer]], [[Damaged goods]] or [[Other]]. Use [[Other]] for a certification test.",
     "Write what happened in [[Notes]].",
     "Press the gold [[Refunds]] button to send it to the terminal.",
     "Intercard asks you to **swipe the same credit card that was used for the payment**. The customer presents that card on the P400.",
     "The refund is approved and **the receipt prints**."],
 fr:["Assurez-vous d'être **connecté sous votre propre nom**. Si la caisse est ouverte sur la session de quelqu'un d'autre, appuyez sur [[Log Out]] et reconnectez-vous avec vos [[User Name]] et [[Password]].",
     "À l'écran de vente, appuyez sur [[Functions]] en bas à gauche.",
     "Dans l'onglet [[Admin]], appuyez sur le bouton doré [[Refunds]] en bas à gauche.",
     "Dans la fenêtre, choisissez [[Credit Card Refund]] - **pas** [[Cash Refund]].",
     "**Tapez le montant du remboursement sur le clavier.** Rien n'est repris de la vente d'origine : prenez le montant sur le reçu du client.",
     "Choisissez un [[Reason Code]] : [[Returned Merchandise]], [[Unhappy customer]], [[Damaged goods]] ou [[Other]]. Utilisez [[Other]] pour un test de certification.",
     "Écrivez ce qui s'est passé dans [[Notes]].",
     "Appuyez sur le bouton doré [[Refunds]] pour l'envoyer au terminal.",
     "Intercard demande de **glisser la même carte de crédit que celle du paiement**. Le client présente cette carte sur le P400.",
     "Le remboursement est approuvé et **le reçu s'imprime**."]},

"pos:Midori|INT-REF":{
 en:["Open the sale in Midori and **scroll the detail drawer to the bottom**.",
     "Click the red [[Refund]] button in the drawer footer.",
     "On the [[Refund to]] screen, tick the line you are refunding under [[Transactions]], then [[Details]]. **Only the original transaction can be refunded.**",
     "Fill in the [[Reason]] field - it is **required**.",
     "Choose the terminal in the [[Payment terminal]] dropdown, for example [[Moneris Front Counter]].",
     "Click the blue [[Send request to charge]] button.",
     "Enter your **5-digit security code** from your Midori profile. It submits on the fifth digit.",
     "The terminal opens the refund screen. The customer **presents their card**.",
     "The refund is approved and **the receipt prints**."],
 fr:["Ouvrez la vente dans Midori et **faites défiler le panneau jusqu'en bas**.",
     "Cliquez le bouton rouge [[Refund]] au bas du panneau.",
     "À l'écran [[Refund to]], cochez la ligne à rembourser sous [[Transactions]], puis [[Details]]. **Seule la transaction d'origine peut être remboursée.**",
     "Remplissez le champ [[Reason]] - il est **obligatoire**.",
     "Choisissez le terminal dans la liste [[Payment terminal]], par exemple [[Moneris Front Counter]].",
     "Cliquez le bouton bleu [[Send request to charge]].",
     "Entrez votre **code de sécurité à 5 chiffres** (celui de votre profil Midori). Il se soumet au cinquième chiffre.",
     "Le terminal ouvre l'écran de remboursement. Le client **présente sa carte**.",
     "Le remboursement est approuvé et **le reçu s'imprime**."]},

"pos:Cluster|INT-REF":{
 en:["**Type YOUR manager PIN** before anything else.",
     "Take the **receipt number** off the customer's printed receipt.",
     "Open [[Search Receipt]], key the number into [[Receipt #]] and tap the green [[Continue]].",
     "[[Order Details]] open on the left, including [[Détails transaction]] - card brand, last 4 and the auth number. **Check them against the receipt.**",
     "In the bottom toolbar tap [[Delete Receipt]]. The refund runs through **Delete Receipt**, **not** [[Edit payment]].",
     "Pick a [[Reason of cancellation]] from the list. **Use the real reason** - [[Training Mode]] is for tests only.",
     "Confirm [[Would you like to delete this receipt?]] with the **green check**.",
     "A second prompt asks [[Some payments were made on this order. Do you want to refund the customer?]] - type the [[Client Name]], then tap [[Full Refund]], or [[Partial Refund]] for part of it.",
     "Cluster creates a refund order [[REMBOURSEMENT POUR]] with the negative line. Tap [[CARD]] in the tender column.",
     "The terminal shows [[Tap, insert or swipe]] with [[Refund total]]. The customer **must present the card again**.",
     "The refund is approved and **the receipt prints**."],
 fr:["**Tapez VOTRE NIP de gestionnaire** avant toute chose.",
     "Prenez le **numéro de reçu** sur le reçu imprimé du client.",
     "Ouvrez [[Search Receipt]], tapez le numéro dans [[Receipt #]] et touchez le [[Continue]] vert.",
     "Les [[Order Details]] s'ouvrent à gauche, avec [[Détails transaction]] - marque de carte, 4 derniers chiffres et numéro d'autorisation. **Vérifiez-les avec le reçu.**",
     "Dans la barre du bas, touchez [[Delete Receipt]]. Le remboursement passe par **Delete Receipt**, **pas** par [[Edit payment]].",
     "Choisissez un [[Reason of cancellation]] dans la liste. **Utilisez la vraie raison** - [[Training Mode]] est réservé aux tests.",
     "Confirmez [[Would you like to delete this receipt?]] avec le **crochet vert**.",
     "Une deuxième invite demande [[Some payments were made on this order. Do you want to refund the customer?]] - tapez le [[Client Name]], puis touchez [[Full Refund]], ou [[Partial Refund]] pour une partie.",
     "Cluster crée une commande de remboursement [[REMBOURSEMENT POUR]] avec la ligne négative. Touchez [[CARD]] dans la colonne des modes de paiement.",
     "Le terminal affiche [[Tap, insert or swipe]] avec [[Refund total]]. Le client **doit représenter sa carte**.",
     "Le remboursement est approuvé et **le reçu s'imprime**."]},

"pos:Embed|INT-REF":{
 warn_en:"Embed drives a **Windcave** pin pad - the one with a physical keypad. The refund is a **void**, so it goes back through Functions rather than through the sale itself. Note the receipt number in step 4 before you leave that screen; you cannot search for it later without it.",
 warn_fr:"Embed pilote un NIP pad **Windcave** - celui avec un clavier physique. Le remboursement est une **annulation (void)**, il passe donc par Functions et non par la vente elle-même. Notez le numéro de reçu à l'étape 4 avant de quitter l'écran : sans lui, impossible de le retrouver ensuite.",
 en:["From the Embed sale screen, **open the functions menu**.",
     "Press [[TRANSACTION HISTORY / CARD TRANSFER]], then **tap the customer's arcade card** on the reader.",
     "Open [[HISTORY]], choose [[SALES]] and find the sale you need to refund.",
     "Click the sale and **write down the [[RECEIPT NO]]** shown at the bottom right of the screen. You need it in a moment.",
     "Go back to [[Functions]] and press [[Void]].",
     "**Search the [[RECEIPT NO]]** you just wrote down.",
     "Press [[VOID]], then [[VOID ALL]].",
     "**Select a reason** for the void. Use [[Testing/Training]] for a certification test.",
     "Press [[NEXT]] to send the refund to the payment terminal.",
     "The customer **taps their card** on the terminal.",
     "The refund is approved and **the receipt prints**."],
 fr:["Depuis l'écran de vente Embed, **ouvrez le menu des fonctions**.",
     "Appuyez sur [[TRANSACTION HISTORY / CARD TRANSFER]], puis **faites passer la carte d'arcade du client** sur le lecteur.",
     "Ouvrez [[HISTORY]], choisissez [[SALES]] et trouvez la vente à rembourser.",
     "Cliquez la vente et **notez le [[RECEIPT NO]]** affiché en bas à droite de l'écran. Vous en aurez besoin dans un instant.",
     "Retournez dans [[Functions]] et appuyez sur [[Void]].",
     "**Cherchez le [[RECEIPT NO]]** que vous venez de noter.",
     "Appuyez sur [[VOID]], puis sur [[VOID ALL]].",
     "**Choisissez une raison** pour l'annulation. Utilisez [[Testing/Training]] pour un test de certification.",
     "Appuyez sur [[NEXT]] pour envoyer le remboursement au terminal de paiement.",
     "Le client **présente sa carte** sur le terminal.",
     "Le remboursement est approuvé et **le reçu s'imprime**."]},

"pos:MYR|INT-REF":{
 en:["In the orders list, switch to the [[Completed]] tab and **tap the order** you are refunding.",
     "Click [[Refund]] on the completed order.",
     "[[Authorization Access]] appears - enter the manager [[PIN Code]] and confirm with the **green check**.",
     "[[ATTENTION! Are you sure that you want to refund this order?]] - tap [[Continue]].",
     "On the [[Refund #1]] panel, check the lines. **Green means included.** Remove a line with the [[X]] or change an amount with [[Edit]] for a **partial refund**.",
     "Confirm [[AMOUNT PAID]] and [[AMOUNT REFUNDED]] **match what you intend**.",
     "Enter the **customer name** in the field below. There is no separate note field, so **write the reason for the refund there too**.",
     "The terminal takes over with the amount. The customer **taps the card again**.",
     "The terminal shows [[Remboursement approuvé]], then offers [[Imprimer]], [[Courriel]], [[Texto]] or [[Aucun reçu]]. Choose [[Imprimer]] and **keep the receipt as your proof**."],
 fr:["Dans la liste des commandes, passez à l'onglet [[Completed]] et **touchez la commande** à rembourser.",
     "Cliquez [[Refund]] sur la commande complétée.",
     "[[Authorization Access]] apparaît - entrez le [[PIN Code]] de gestionnaire et confirmez avec le **crochet vert**.",
     "[[ATTENTION! Are you sure that you want to refund this order?]] - touchez [[Continue]].",
     "Dans le panneau [[Refund #1]], vérifiez les lignes. **Vert = incluse.** Retirez une ligne avec le [[X]] ou changez un montant avec [[Edit]] pour un **remboursement partiel**.",
     "Vérifiez que [[AMOUNT PAID]] et [[AMOUNT REFUNDED]] **correspondent à votre intention**.",
     "Entrez le **nom du client** dans le champ du bas. Il n'y a pas de champ de note distinct : **inscrivez-y aussi la raison du remboursement**.",
     "Le terminal prend le relais avec le montant. Le client **représente sa carte**.",
     "Le terminal affiche [[Remboursement approuvé]], puis propose [[Imprimer]], [[Courriel]], [[Texto]] ou [[Aucun reçu]]. Choisissez [[Imprimer]] et **gardez le reçu comme preuve**."]}
};

/* A manual refund on a Midori terminal is invisible to Midori until you
   record it there by hand. Appended to the manual steps on Midori tills. */

export const MANUAL_TAIL = {
 Midori:{
  en:["**Now save it in Midori**, or the sale still shows as paid. Open the sale again and press [[Refund]].",
      "**Check the amount** matches what you just refunded on the terminal.",
      "In the note, write that this was a **manual refund done on the payment terminal**, and include the **receipt number of the refund**.",
      "Press [[Refund]] in Midori to save it."],
  fr:["**Enregistrez-le maintenant dans Midori**, sinon la vente reste affichée comme payée. Rouvrez la vente et appuyez sur [[Refund]].",
      "**Vérifiez que le montant** correspond à celui que vous venez de rembourser sur le terminal.",
      "Dans la note, indiquez qu'il s'agit d'un **remboursement manuel fait sur le terminal de paiement**, avec le **numéro de reçu du remboursement**.",
      "Appuyez sur [[Refund]] dans Midori pour enregistrer."]
 }
};

/* ---- rules that apply to EVERY refund, integrated or manual ---- */

export const UNIVERSAL = {
 en:["Refund on the **same card the customer paid with**. Never to a different card, never to cash.",
     "Print the refund receipt and have the customer **sign the merchant copy**. The signature confirms the refund was issued and that the customer was there when it happened.",
     "Put the signed merchant copy in the **nightly deposit**. No signed copy in the deposit means the refund is unsupported at reconciliation.",
     "Hand the customer **their own copy**."],
 fr:["Remboursez sur la **même carte que celle du paiement**. Jamais sur une autre carte, jamais en argent comptant.",
     "Imprimez le reçu de remboursement et faites **signer la copie marchand** par le client. La signature confirme que le remboursement a bien été fait et que le client était présent.",
     "Déposez la copie marchand signée dans le **dépôt de fin de journée**. Sans copie signée au dépôt, le remboursement n'est pas justifié à la conciliation.",
     "Remettez au client **sa propre copie**."]
};

/* Screenshots for individual steps. Key: "<PROCS key>|<step number, 1-based>".
   Values are data: URIs so the page stays self-contained. Empty until the
   screenshots land in the Drive/local drop folder.                         */

export const VIDEO_FOLDER = "1qqRjnf02Y3LPbakrkX9D_e-0ewGT6C6n";
/* Drive file id per procedure key. Empty value = fall back to the folder. */
export const PROC_VIDEO = {
  "pos:Midori|INT-REF":"",
  "pos:Cluster|INT-REF":"",
  "pos:Embed|INT-REF":"",
  "pos:MYR|INT-REF":"",
  "manual:Moneris|MANUAL-REF":"",
  "manual:Clover|MANUAL-REF":"",
  "pos:Intercard|INT-REF":""
};
export function videoHref(pk){
  var id = PROC_VIDEO[pk];
  return id ? "https://drive.google.com/file/d/"+id+"/view" : (FOLDER+VIDEO_FOLDER);
}
