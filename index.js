require("dotenv").config();
const { MessageFlags } = require("discord.js");
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  Routes,
} = require("discord.js");
const { REST } = require("@discordjs/rest");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  entersState,
  VoiceConnectionStatus,
} = require("@discordjs/voice");
const fs = require("fs");
const path = require("path");

// Configuration du logging
const log = (message, level = "INFO") => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
};

// Gestion des erreurs non catchées
process.on("uncaughtException", (err) => {
  log(`Erreur non catchée: ${err.stack}`, "ERROR");
});

process.on("unhandledRejection", (reason, promise) => {
  log(`Rejet non géré à: ${promise}, raison: ${reason}`, "ERROR");
});

// Configuration
const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  textChannelId: process.env.TEXT_CHANNEL_ID,
  voiceChannelId: process.env.VOICE_CHANNEL_ID,
  audioFile: path.join(__dirname, "around_the_world.mp3"),
};

// Vérifications
if (
  !config.token ||
  !config.clientId ||
  !config.textChannelId ||
  !config.voiceChannelId
) {
  log("Configuration manquante dans .env", "ERROR");
  process.exit(1);
}

if (!fs.existsSync(config.audioFile)) {
  log(`Fichier audio introuvable: ${config.audioFile}`, "ERROR");
  process.exit(1);
}

log("Configuration chargée avec succès");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

// Gestion de la connexion
let connection;
const player = createAudioPlayer();

// Gestion audio améliorée avec reconnexion automatique
function setupPlayer() {
  player.on(AudioPlayerStatus.Idle, () => {
    try {
      log("Le lecteur est inactif, relecture de la musique");
      playMusic();
    } catch (err) {
      log(`Erreur lors de la relecture: ${err.message}`, "ERROR");
    }
  });

  player.on("error", (error) => {
    log(`Erreur audio: ${error.message}`, "ERROR");
    setTimeout(() => playMusic(), 5000); // Tentative de reconnexion après 5s
  });

  player.on(AudioPlayerStatus.Playing, () => {
    log("Musique en cours de lecture");
  });
}

function playMusic() {
  try {
    const resource = createAudioResource(config.audioFile, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });
    player.play(resource);
    log("Musique lancée avec succès");
  } catch (err) {
    log(`Erreur lors du lancement de la musique: ${err.message}`, "ERROR");
    throw err;
  }
}

async function connectToVoice() {
  try {
    log(`Tentative de connexion au salon vocal ${config.voiceChannelId}`);
    const voiceChannel = await client.channels.fetch(config.voiceChannelId);

    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      log("Déconnecté du salon vocal, tentative de reconnexion...", "WARN");
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          entersState(connection, VoiceConnectionStatus.Destroyed, 5_000),
        ]);
      } catch (error) {
        log(`Échec de reconnexion: ${error.message}`, "ERROR");
        connection.destroy();
      }
    });

    connection.subscribe(player);
    playMusic();
    return true;
  } catch (error) {
    log(`Erreur de connexion vocale: ${error.message}`, "ERROR");
    return false;
  }
}

async function disconnectFromVoice() {
  if (connection) {
    try {
      log("Déconnexion du salon vocal");
      connection.destroy();
      player.stop();
      connection = null;
    } catch (err) {
      log(`Erreur lors de la déconnexion: ${err.message}`, "ERROR");
    }
  }
}

// Gestion propre des arrêts
function cleanup() {
  log("Nettoyage avant arrêt...");
  disconnectFromVoice()
    .then(() => {
      log("Nettoyage terminé, arrêt du processus");
      process.exit(0);
    })
    .catch((err) => {
      log(`Erreur lors du nettoyage: ${err.message}`, "ERROR");
      process.exit(1);
    });
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Enregistrement des commandes slash
const registerCommands = async () => {
  try {
    const commands = [
      new SlashCommandBuilder()
        .setName("join")
        .setDescription("Fait rejoindre le bot dans le salon vocal"),
      new SlashCommandBuilder()
        .setName("quit")
        .setDescription("Fait quitter le bot du salon vocal"),
    ].map((command) => command.toJSON());

    const rest = new REST({ version: "10" }).setToken(config.token);

    log("Enregistrement des commandes slash...");
    await rest.put(Routes.applicationCommands(config.clientId), {
      body: commands,
    });
    log("Commandes slash enregistrées avec succès");
  } catch (error) {
    log(
      `Erreur lors de l'enregistrement des commandes: ${error.message}`,
      "ERROR",
    );
  }
};

// Événements du bot
client.on("ready", async () => {
  log(`Connecté en tant que ${client.user.tag}`);
  setupPlayer();
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  try {
    if (interaction.commandName === "join") {
      if (await connectToVoice()) {
        log(`Commande /join exécutée par ${interaction.user.tag}`);
        await interaction.reply({
          content: "🔊 Je suis dans le salon vocal !",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: "❌ Impossible de rejoindre le salon vocal",
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    if (interaction.commandName === "quit") {
      log(`Commande /quit exécutée par ${interaction.user.tag}`);
      await disconnectFromVoice();
      await interaction.reply({
        content: "✅ J'ai quitté le salon vocal",
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (err) {
    log(`Erreur lors du traitement de l'interaction: ${err.message}`, "ERROR");
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (/around\s*the\s*world/gi.test(message.content)) {
    log(`Détection "Around the World" par ${message.author.tag}`);
    await message.reply("Around the World 🌍🎶");
  }
});

client.login(config.token).catch((err) => {
  log(`Erreur de connexion: ${err.message}`, "ERROR");
  process.exit(1);
});
