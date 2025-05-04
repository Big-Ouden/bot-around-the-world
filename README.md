Daft Punk Music Bot - README

Un bot Discord qui joue "Around the World" en boucle avec des fonctionnalités avancées.

Fonctionnalités principales:

- Joue la musique en continu dans un salon vocal
- Répond aux mentions de "around the world"
- Commandes slash (/join, /quit)
- Gestion robuste des erreurs
- Logs détaillés

Installation:

1. Prérequis:

- Node.js v16+
- Compte Discord developer
- Fichier MP3 "around_the_world.mp3"

2. Configuration:

- Créer un fichier .env avec:
  DISCORD_TOKEN="votre_token"
  CLIENT_ID="votre_client_id"
  TEXT_CHANNEL_ID="id_salon_text"
  VOICE_CHANNEL_ID="id_salon_vocal"

3. Commandes:
   /join - Rejoint le salon vocal
   /quit - Quitte le salon vocal

4. Démarrer:
   npm install
   node index.js

Pour inviter le bot:
https://discord.com/oauth2/authorize?client_id=VOTRE_CLIENT_ID&scope=bot%20applications.commands

Notes:

- Le bot nécessite les permissions de rejoindre les salons vocaux
- Assurez-vous d'avoir le fichier audio dans le bon format
- Les logs sont enregistrés dans la console

Licence: MIT
