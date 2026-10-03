import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "VÍDEO · EDIÇÃO BÁSICA", icon: "🎬", entries: [
        {"command":"cortarvideo","arguments":"<inicio> <fim>", "description":"Recortar o vídeo entre os tempos indicados."},
        {"command":"tomp3","description":"Extrair o áudio do vídeo em MP3."},
    ] },
    { title: "VÍDEO · VELOCIDADE", icon: "🎬", entries: [
        {"command":"videorapido"},
        {"command":"fastvid"},
        {"command":"videoslow"},
        {"command":"videolento"},
    ] },
    { title: "VÍDEO · EFEITOS", icon: "🎬", entries: [
        {"command":"videoreverso"},
        {"command":"videoloop"},
        {"command":"videomudo"},
        {"command":"videobw"},
        {"command":"pretoebranco"},
        {"command":"sepia"},
        {"command":"espelhar"},
        {"command":"rotacionar"},
    ] },
    { title: "IMAGENS", icon: "🎨", optionKey: "imageMenuTitle", entries: [
        {"command":"rmbg", "description":"Remover o fundo da imagem."},
        {"command":"upscale", "description":"Aumentar a resolução da imagem."},
    ] },
    { title: "ÁUDIO · EDIÇÃO BÁSICA", icon: "🎧", entries: [
        {"command":"cortaraudio","arguments":"<inicio> <fim>", "description":"Recortar o áudio entre os tempos indicados."},
        {"command":"velocidade","arguments":"<0.5-3.0>", "description":"Alterar a velocidade do áudio."},
        {"command":"speed","arguments":"<0.5-3.0>", "description":"Alterar a velocidade do áudio."},
        {"command":"normalizar", "description":"Normalizar o volume do áudio."},
    ] },
    { title: "ÁUDIO · MUDANÇA DE VOZ", icon: "🎧", entries: [
        {"command":"boyvoice"},
        {"command":"vozmenino"},
        {"command":"womenvoice"},
        {"command":"vozmulher"},
        {"command":"manvoice"},
        {"command":"vozhomem"},
        {"command":"childvoice"},
        {"command":"vozcrianca"},
    ] },
    { title: "ÁUDIO · EFEITOS DE VELOCIDADE", icon: "🎧", entries: [
        {"command":"speedup"},
        {"command":"vozrapida"},
        {"command":"audiorapido"},
        {"command":"vozlenta"},
        {"command":"audiolento"},
    ] },
    { title: "ÁUDIO · GRAVES", icon: "🎧", entries: [
        {"command":"bass"},
        {"command":"bass2"},
        {"command":"bass3"},
        {"command":"bassbn","arguments":"<1-20>"},
        {"command":"grave"},
        {"command":"vozgrave"},
    ] },
    { title: "ÁUDIO · EFEITOS ESPECIAIS", icon: "🎧", entries: [
        {"command":"vozeco"},
        {"command":"eco"},
        {"command":"vozcaverna"},
        {"command":"reverb"},
        {"command":"reversobn"},
        {"command":"reverse"},
        {"command":"audioreverso"},
        {"command":"chorus"},
        {"command":"phaser"},
        {"command":"flanger"},
        {"command":"tremolo"},
        {"command":"vibrato"},
    ] },
    { title: "ÁUDIO · VOLUME & EQUALIZAÇÃO", icon: "🎧", entries: [
        {"command":"volumeboost"},
        {"command":"aumentarvolume"},
        {"command":"equalizer"},
        {"command":"equalizar"},
        {"command":"overdrive"},
        {"command":"pitch"},
        {"command":"lowpass"},
    ] },
];

export default async function menuAlterador(prefix, _botName = "SHOGUN", userName = "Usuário", options = {}) {
    return renderShogunMenu({
        intro: "Cortes, conversões e efeitos para áudio, vídeo e imagem.",
        footer: "Responda à mídia com o comando de edição e os parâmetros indicados.",
        options,
        title: "EDIÇÃO DE MÍDIA", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
