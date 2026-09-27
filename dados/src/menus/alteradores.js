import { prepareMenuSections, renderShogunMenu } from "./presentation.js";

const sections = [
    { title: "VÍDEO · EDIÇÃO BÁSICA", entries: [
        {"command":"cortarvideo","arguments":"<inicio> <fim>"},
        {"command":"tomp3","description":"Converter para áudio"},
    ] },
    { title: "VÍDEO · VELOCIDADE", entries: [
        {"command":"videorapido"},
        {"command":"fastvid"},
        {"command":"videoslow"},
        {"command":"videolento"},
    ] },
    { title: "VÍDEO · EFEITOS", entries: [
        {"command":"videoreverso"},
        {"command":"videoloop"},
        {"command":"videomudo"},
        {"command":"videobw"},
        {"command":"pretoebranco"},
        {"command":"sepia"},
        {"command":"espelhar"},
        {"command":"rotacionar"},
    ] },
    { title: "IMAGENS", optionKey: "imageMenuTitle", entries: [
        {"command":"rmbg"},
        {"command":"upscale"},
    ] },
    { title: "ÁUDIO · EDIÇÃO BÁSICA", entries: [
        {"command":"cortaraudio","arguments":"<inicio> <fim>"},
        {"command":"velocidade","arguments":"<0.5-3.0>"},
        {"command":"speed","arguments":"<0.5-3.0>"},
        {"command":"normalizar"},
    ] },
    { title: "ÁUDIO · MUDANÇA DE VOZ", entries: [
        {"command":"boyvoice"},
        {"command":"vozmenino"},
        {"command":"womenvoice"},
        {"command":"vozmulher"},
        {"command":"manvoice"},
        {"command":"vozhomem"},
        {"command":"childvoice"},
        {"command":"vozcrianca"},
    ] },
    { title: "ÁUDIO · EFEITOS DE VELOCIDADE", entries: [
        {"command":"speedup"},
        {"command":"vozrapida"},
        {"command":"audiorapido"},
        {"command":"vozlenta"},
        {"command":"audiolento"},
    ] },
    { title: "ÁUDIO · EFEITOS DE BASS & GRAVE", entries: [
        {"command":"bass"},
        {"command":"bass2"},
        {"command":"bass3"},
        {"command":"bassbn","arguments":"<1-20>"},
        {"command":"grave"},
        {"command":"vozgrave"},
    ] },
    { title: "ÁUDIO · EFEITOS ESPECIAIS", entries: [
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
    { title: "ÁUDIO · VOLUME & EQUALIZAÇÃO", entries: [
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
        options,
        title: "ALTERADORES", prefix, userName,
        sections: prepareMenuSections(sections, options),
    });
}
