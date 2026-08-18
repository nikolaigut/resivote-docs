---
title: Documents et règlements
description: Gestion documentaire, structure des dossiers, chiffrement et import de règlement dans ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote gère les documents dans une structure de dossiers hiérarchique par communauté. Tous les fichiers sont stockés chiffrés. L'import de règlement extrait les métadonnées et les unités des PDF par IA.

## Document

Un document représente un fichier dans le portail propriétaire. L'accès est contrôlé via le dossier associé.

| Champ | Signification |
|------|---------------|
| Mandant | Isolation multi-mandants |
| Communauté | Communauté (nullable pour les dossiers à l'échelle du mandant) |
| Dossier parent | Obligatoire |
| Nom d'affichage | Titre du document |
| Catégorie | Catégorie normalisée |
| Nom de fichier | Nom de fichier nettoyé |
| Type MIME | Type de fichier |
| Taille | Taille du fichier |
| Indicateur non lu | Marque les documents non consultés |

### Catégories de documents

La catégorie est normalisée en majuscules et validée par rapport aux valeurs autorisées :

Procès-verbal, invitation, compte annuel, règlement, avis, formulaire, autre

Les valeurs invalides sont définies sur « autre ».

### Nettoyage des noms de fichiers

Le système nettoie les noms de fichiers en supprimant les composants de chemin et en remplaçant les caractères dangereux. Les noms vides sont définis sur une valeur par défaut. Cela empêche les attaques par traversée de chemin.

## Dossier

Un dossier forme une structure hiérarchique au sein d'une communauté ou d'un mandant.

| Champ | Signification |
|------|---------------|
| Communauté | Communauté (nullable pour les dossiers à l'échelle du mandant) |
| Dossier parent | Dossier parent (nullable pour la racine) |
| Propriétaire | Propriétaire pour les dossiers personnels (nullable) |
| Nom | Nom du dossier |
| Visibilité | Publique ou restreinte |
| Chemin | Chemin complet (p. ex. `Rapports annuels/2024`) |
| Nombre de documents | Nombre de documents dans le dossier |

### Visibilité

- **Publique** – visible pour tous les propriétaires de la communauté ou du mandant.
- **Restreinte** – visible uniquement pour le propriétaire. Les dossiers personnels doivent être restreints.

### Service de dossiers

Le service de dossiers construit la structure des dossiers et valide les règles :

- **Unicité du chemin** – au sein d'une communauté, aucun chemin en double ne peut exister.
- **Même nom dans différentes communautés** – autorisé, car l'unicité est vérifiée par communauté.
- **Les sous-dossiers héritent de la visibilité** – un sous-dossier doit avoir la même visibilité et le même propriétaire que son parent.
- **Le parent doit être dans la même communauté** – un sous-dossier doit se trouver dans la même communauté que son parent.
- **Dossier personnel** – le système crée automatiquement un dossier restreint par propriétaire, nommé d'après le nom complet du propriétaire.

### Construction de l'arbre et nombre de documents

Le système charge tous les dossiers d'une communauté, filtre pour les utilisateurs non privilégiés (uniquement les dossiers publics et les dossiers personnels propres), construit l'arbre et remplit le nombre de documents par dossier.

## Backends de stockage

ResiVote prend en charge deux backends de stockage :

| Backend | Configuration |
|---------|--------------|
| **Système de fichiers local** | Chemin local (par défaut : `./uploads`) |
| **S3 / MinIO** | Configuration S3 avec endpoint, bucket, région et clés d'accès |

La clé de stockage est construite de manière hiérarchique selon le mandant, la communauté, le dossier et le document.

### Taille maximale de téléchargement

La taille des téléchargements est limitée. Valeur par défaut : 50 Mo. Les fichiers qui dépassent la limite sont rejetés.

## Chiffrement

<Aside type="note" title="Chiffrement au repos">
Chaque document est chiffré avant d'être stocké. Le déchiffrement s'effectue uniquement lors d'un téléchargement autorisé. Le stockage ne contient jamais de texte en clair.
</Aside>

### Couches

Le chiffrement se compose de deux composants :

1. **Gestion des clés par mandant** – gère les clés de chiffrement de données par mandant :
   - Une clé de chiffrement est générée par mandant et enveloppée avec la clé maîtresse.
   - La clé est dépaquetée au besoin.
   - Une clé de document est dérivée à partir de la clé du mandant et de l'identifiant du document.

2. **Chiffrement des documents** – chiffre et déchiffre les contenus de fichiers :
   - Le chiffrement lit le texte en clair, dérive la clé de document et chiffre le contenu.
   - Le déchiffrement inverse le processus.

La clé maîtresse est configurée via une variable d'environnement.

### Contrôle d'accès

Le système vérifie par document :

- **Dossier personnel** – seul le propriétaire obtient l'accès.
- **Dossier de communauté** – les propriétaires doivent appartenir à la communauté.
- **Dossier public** – tous les propriétaires du mandant.

## Import de règlement

L'import de règlement est un processus en deux phases :

### Phase 1 : Extraction

<Steps>
  1. **Télécharger le PDF** – Le système reçoit un PDF (max. 50 Mo, en-tête PDF validé).
  2. **Extraire le texte** – Le système extrait le texte du PDF.
  3. **Nettoyer le texte** – Les caractères de contrôle sont supprimés.
  4. **Filtrer le texte** – Le système ne conserve que les sections pertinentes (mots-clés en DE/FR/IT/EN, modèles de quotas, modèles d'unités). L'en-tête est toujours inclus. Maximum 40 000 caractères.
  5. **Appeler le fournisseur d'IA** – Le texte filtré est envoyé au fournisseur d'IA configuré.
  6. **Analyser la réponse** – Le système analyse la réponse de l'IA, valide le type de communauté (STWEG/MEG) et le modèle de droit de vote, rejette les unités sans désignation, plafonne à 500 unités.
  7. **Retourner le brouillon** – Le brouillon contient les métadonnées de communauté, les unités et les avertissements. Aucune écriture en base de données à ce stade.
</Steps>

### Phase 2 : Confirmation

<Steps>
  1. **Vérifier les données** – L'utilisateur vérifie et édite le brouillon dans le frontend.
  2. **Confirmer** – Le système valide le nom et le type (STWEG/MEG).
  3. **Créer la communauté** – La communauté est créée avec toutes les métadonnées.
  4. **Créer les unités** – Chaque unité est créée (désignation, quote-part de valeur, numéro de registre foncier, etc.).
  5. **Importer les propriétaires** – optionnel : si un e-mail ou un nom est présent, un propriétaire est créé ou associé par e-mail, plus une part de propriété (1/1, électeur principal).
</Steps>

<Aside type="warning" title="Pas de rollback automatique">
Si la création d'une unité échoue, la communauté déjà créée n'est pas automatiquement annulée. L'appelant doit gérer les échecs partiels.
</Aside>

### Quorums configurables par règlement

La communauté contient trois champs de règlement optionnels qui remplacent les standards par type de communauté :

| Champ | Signification | Standard (non défini) |
|------|---------------|-----------------|
| Quorum de voix par tête en % | Seuil de voix par tête | STWEG : 50, MEG : 50 |
| Quorum de quotes-parts de valeur en % | Seuil de quotes-parts de valeur | STWEG : 50, MEG : 50 |
| Nombre minimum de propriétaires présents | Seuil de propriétaires | STWEG : 2, MEG : 1 |

Détails sur le calcul du quorum voir `/guides/quorum/`.

### Limitation du droit de vote (Art. 712g ZGB)

La communauté contient deux champs pour la limitation réglementaire du droit de vote :

- **Activation** – par défaut désactivée. Doit être explicitement activée.
- **Pourcentage de plafonnement** – par défaut 50%. Plafonne les voix par tête d'un propriétaire lorsque sa part de la valeur totale dépasse le pourcentage.

Le moteur de quorum marque les propriétaires concernés et indique que la limitation du droit de vote a été appliquée.

## Liens complémentaires

<LinkCard title="Quorum et présence" href="/guides/quorum/" description="Capacité de résolution et quorums de règlement." />
