---
title: Créer une assemblée
description: Créer une assemblée, définir les points de l'ordre du jour et la publier – du brouillon à l'invitation.
---

import { Steps, Aside, CardGrid, Card } from '@astrojs/starlight/components';

Ce guide s'adresse aux administrateurs de mandant et aux présidents. Il décrit comment créer une assemblée au statut brouillon, la munir de points de l'ordre du jour et la publier.

## Cycle de vie d'une assemblée

Chaque assemblée traverse un flux de statuts défini :

| Statut | Signification |
| --- | --- |
| Brouillon | Phase de préparation – l'assemblée n'est pas encore visible. |
| Publiée | Les invitations ont été envoyées. |
| Enregistrement | La phase d'enregistrement est ouverte. |
| En cours | L'assemblée est en cours, les points de l'ordre du jour sont traités. |
| Clôturée | L'assemblée a été clôturée. |
| Archivée | L'assemblée est archivée. |

Transitions valides : Brouillon → Publiée, Publiée → Enregistrement, Enregistrement → En cours, En cours → Clôturée, Clôturée → Archivée. À partir du statut archivée, aucune autre transition n'est possible.

## Modes d'assemblée

Lors de la création, vous choisissez le mode de l'assemblée :

- **Assemblée en direct** – Assemblée en présentiel, hybride ou en ligne en temps réel. Valeur par défaut.
- **Résolution circulaire** – Résolution circulaire (Art. 712m al. 2 ZGB). Requiert obligatoirement une fenêtre de vote avec date de début et de fin. Le début doit précéder la fin.

## Créer une assemblée

<Steps>

1. **Saisir les données de base.** Définissez le titre, la description, la date et le lieu. Le système vérifie qu'aucune autre assemblée du même mandant n'est déjà planifiée à la date choisie. Un identifiant unique est généré automatiquement.

2. **Choisir le mode et la méthode d'enregistrement.** Définissez le mode d'assemblée : assemblée en direct ou résolution circulaire. Choisissez la méthode d'enregistrement :
   - Manuel – le président marque manuellement les propriétaires présents (par défaut).
   - QR-code – les propriétaires s'enregistrent eux-mêmes via un QR-code.
   - Signature – les propriétaires signent sur la tablette de l'administrateur.

3. **Définir la visibilité des résultats en direct.** Vous déterminez qui voit les résultats en direct pendant un vote ouvert :
   - Tous les participants – tous les participants voient les résultats intermédiaires (par défaut).
   - Président et administrateur – seuls le président et l'administrateur voient les résultats en direct.

4. **Activer la confirmation de vote (optionnel).** Activez cette option si les propriétaires doivent confirmer explicitement leur vote.

5. **Associer les communautés.** Associez une ou plusieurs communautés à l'assemblée. Cette association permet les assemblées multi-communautés.

</Steps>

## Créer des points de l'ordre du jour

Chaque point de l'ordre du jour appartient à une assemblée et possède les propriétés suivantes :

- **Numéro d'ordre** – ordre dans l'assemblée.
- **Titre** et **description** – désignation et explication.
- **Type** – type de point de l'ordre du jour :
  - Motion – vote oui/non/abstention.
  - Élection – élections ; requiert une liste de noms de candidats.
  - Texte libre – vote en texte libre.
  - Procès-verbal – désignation du rédacteur du procès-verbal, sans vote.
- **Quorum** – modèle de quorum pour ce point : majorité simple, majorité qualifiée, unanimité, majorité absolue ou personnalisé. Pour un quorum personnalisé, vous définissez un pourcentage et optionnellement un pourcentage séparé pour les quotes-parts de valeur ; la base peut être les présents ou tous les autorisés.
- **Communauté** – référence à la communauté. Une valeur vide signifie que le point s'applique à toutes les communautés de l'assemblée.

Pour une assemblée en direct, le système crée automatiquement le point procédural « Désignation du rédacteur du procès-verbal » (numéro d'ordre 0). Dès que vous désignez le rédacteur du procès-verbal, le système ferme automatiquement ce point.

## Configurer le rédacteur du procès-verbal

Le rédacteur du procès-verbal est défini par son type et, le cas échéant, par le propriétaire désigné :

- **Propriétaire** – un propriétaire tient le procès-verbal.
- **Administrateur** – un administrateur tient le procès-verbal.

Cette configuration n'est autorisée que pour les assemblées en direct et n'est plus modifiable une fois l'assemblée clôturée ou archivée.

## Télécharger des pièces jointes

Les pièces jointes peuvent être gérées à deux niveaux :

- **Pièces jointes d'assemblée** – documents généraux pour l'ensemble de l'assemblée.
- **Pièces jointes de point de l'ordre du jour** – documents relatifs à un point spécifique.

De plus, ResiVote prend en charge les diapositives en ligne pour les présentations au sein d'un point de l'ordre du jour.

## Publier l'assemblée

La publication effectue la transition d'état de brouillon à publiée. Les actions suivantes se produisent :

1. Le système valide et définit le statut sur publié.
2. Le système planifie la séquence d'e-mails : une invitation immédiate et un rappel sept jours avant la date de l'assemblée.
3. Les invitations sont envoyées dans la mesure du possible immédiatement ; en cas d'échec d'envoi, l'assemblée reste néanmoins publiée.

<Aside type="note" title="Mises à jour">
  Les assemblées ne peuvent être modifiées que dans le statut brouillon ou publié. Dès que l'assemblée atteint le statut d'enregistrement ou un statut ultérieur, les modifications des données de base sont verrouillées.
</Aside>

<CardGrid>
  <Card title="Effectuer des votes" icon="seti:vote">
    Comment les points de l'ordre du jour sont soumis au vote et quels modèles de vote s'appliquent.
  </Card>
  <Card title="Enregistrement et présence" icon="seti:check">
    Comment les propriétaires sont marqués présents à l'assemblée.
  </Card>
</CardGrid>
