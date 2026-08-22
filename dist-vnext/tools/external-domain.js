import axios from 'axios';
const SIGNOS = Object.freeze([
    'aries', 'touro', 'gemeos', 'cancer', 'leao', 'virgem',
    'libra', 'escorpiao', 'sagitario', 'capricornio', 'aquario', 'peixes',
]);
const SIGN_EMOJIS = Object.freeze({
    aries: '♈', touro: '♉', gemeos: '♊', cancer: '♋',
    leao: '♌', virgem: '♍', libra: '♎', escorpiao: '♏',
    sagitario: '♐', capricornio: '♑', aquario: '♒', peixes: '♓',
});
function socketOf(context) {
    const socket = context.socket;
    if (!socket || typeof socket.sendMessage !== 'function') {
        throw new Error('Socket legado não expõe sendMessage no domínio externo de ferramentas.');
    }
    return socket;
}
function normalizeLegacyText(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/gu, '')
        .trim()
        .toLowerCase();
}
function asWttrPayload(value) {
    return value;
}
function asHoroscopePayload(value) {
    return value;
}
export class ExternalToolsDomainDispatchTarget {
    httpGet;
    handlers = new Map();
    constructor(httpGet = (url, options) => axios.get(url, options)) {
        this.httpGet = httpGet;
        const climate = this.climateCommand.bind(this);
        const horoscope = this.horoscopeCommand.bind(this);
        for (const token of ['clima', 'tempo', 'weather', 'previsao'])
            this.handlers.set(token, climate);
        for (const token of ['horoscopo', 'signo'])
            this.handlers.set(token, horoscope);
    }
    async dispatch(command, context) {
        const handler = this.handlers.get(String(command || '').trim().toLowerCase());
        if (!handler)
            return false;
        await handler(context);
        return true;
    }
    async climateCommand(context) {
        const query = context.query.trim();
        if (!query) {
            await context.reply(`🌤️ *Previsão do Tempo*\n\n💡 *Como usar:*\n• ${context.prefix}clima <cidade>\n\n📌 *Exemplos:*\n• ${context.prefix}clima São Paulo\n• ${context.prefix}clima Rio de Janeiro\n• ${context.prefix}clima Tokyo`);
            return;
        }
        await context.reply('🌤️ Consultando previsão do tempo... ⏳');
        try {
            const city = encodeURIComponent(query);
            const response = await this.httpGet(`https://wttr.in/${city}?format=j1&lang=pt`, {
                timeout: 120000,
                headers: { 'User-Agent': 'curl/7.68.0' },
            });
            const data = asWttrPayload(response.data);
            const current = data.current_condition[0];
            const location = data.nearest_area[0];
            if (!current || !location)
                throw new Error('Resposta wttr.in incompleta.');
            const description = current.lang_pt?.[0]?.value || current.weatherDesc[0]?.value || '';
            const cityName = location.areaName[0]?.value || '';
            const region = location.region[0]?.value || '';
            const country = location.country[0]?.value || '';
            let weatherEmoji = '☀️';
            const normalizedDescription = description.toLowerCase();
            if (normalizedDescription.includes('chuva') || normalizedDescription.includes('rain'))
                weatherEmoji = '🌧️';
            else if (normalizedDescription.includes('parcialmente'))
                weatherEmoji = '⛅';
            else if (normalizedDescription.includes('nublado') || normalizedDescription.includes('cloud'))
                weatherEmoji = '☁️';
            else if (normalizedDescription.includes('neve') || normalizedDescription.includes('snow'))
                weatherEmoji = '❄️';
            else if (normalizedDescription.includes('trovoada') || normalizedDescription.includes('thunder'))
                weatherEmoji = '⛈️';
            else if (normalizedDescription.includes('nevoeiro') || normalizedDescription.includes('fog'))
                weatherEmoji = '🌫️';
            else if (normalizedDescription.includes('sol') || normalizedDescription.includes('clear'))
                weatherEmoji = '☀️';
            let forecast = '';
            if (data.weather && data.weather.length > 0) {
                forecast = '\n\n📅 *Próximos dias:*\n';
                data.weather.slice(0, 3).forEach((day) => {
                    const date = day.date.split('-').reverse().join('/');
                    forecast += `• ${date}: ${day.mintempC}°C - ${day.maxtempC}°C\n`;
                });
            }
            await context.reply(`${weatherEmoji} *Clima em ${cityName}*\n📍 ${region}, ${country}\n\n🌡️ *Temperatura:* ${current.temp_C}°C\n🤒 *Sensação:* ${current.FeelsLikeC}°C\n💧 *Umidade:* ${current.humidity}%\n💨 *Vento:* ${current.windspeedKmph} km/h (${current.winddir16Point})\n☀️ *Índice UV:* ${current.uvIndex}\n👁️ *Visibilidade:* ${current.visibility} km\n☁️ *Nuvens:* ${current.cloudcover}%\n\n📋 *Condição:* ${description}${forecast}`);
        }
        catch (error) {
            console.error('Erro ao buscar clima:', error);
            await context.reply('❌ Não consegui encontrar informações do clima para essa cidade. Verifique o nome e tente novamente!');
        }
    }
    async horoscopeCommand(context) {
        const query = context.query.trim();
        if (!query) {
            await context.reply('❌ Você precisa informar um signo para buscar a previsão.');
            return;
        }
        const normalizedQuery = normalizeLegacyText(query);
        if (!SIGNOS.includes(normalizedQuery)) {
            await context.reply('❌ Signo inválido! Os signos disponíveis são:\n♈ Áries\n♉ Touro\n♊ Gêmeos\n♋ Câncer\n♌ Leão\n♍ Virgem\n♎ Libra\n♏ Escorpião\n♐ Sagitário\n♑ Capricórnio\n♒ Aquário\n♓ Peixes');
            return;
        }
        let result;
        try {
            const response = await this.httpGet(`https://apisnodz.com.br/api/pesquisas/horoscopo?query=${normalizedQuery}`);
            result = asHoroscopePayload(response.data).resultado;
        }
        catch {
            await context.reply('❌ Erro ao gerar horóscopo. Tente novamente!');
            return;
        }
        if (!result)
            return;
        const emoji = SIGN_EMOJIS[normalizedQuery] || '🔮';
        const signName = result.signo.charAt(0).toUpperCase() + result.signo.slice(1);
        const caption = `🔮 *HORÓSCOPO* 🔮\n\n${emoji} *Signo:* ${signName}\n📅 *Data:* ${result.dia}\n✨ *Previsão do Dia:*\n${result.previsao}\n\n🔗 Fonte: Horóscopo Virtual\n🌐 ${result.url}`;
        try {
            await socketOf(context).sendMessage(context.groupId, { image: { url: result.imagem }, caption }, { quoted: context.message });
        }
        catch {
            await context.reply('❌ Erro ao enviar imagem do horóscopo. Tente novamente!');
        }
    }
}
export const EXTERNAL_TOOLS_NATIVE_COMMAND_TOKENS = Object.freeze([
    'clima', 'tempo', 'weather', 'previsao', 'horoscopo', 'signo',
]);
//# sourceMappingURL=external-domain.js.map