import axios from 'axios';
import * as cheerio from 'cheerio';

const removerAcentos = (s) => typeof s === 'string' ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

async function Dicionario(query) {
    try {
        const url = `https://www.dicio.com.br/${removerAcentos(query)}/`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const data = response.data;
        const $ = cheerio.load(data);

        const resultado = {
            palavra: $('h1').first().text().trim().replace('amor', '').trim(),
            url, 
            significado: '',
            significados: [], 
            classe: '',
            separacao: '', 
            plural: '',
            etimologia: '', 
            sinonimos: [],
            antonimos: [], 
            frases: [],
            exemplos: [], 
            rimas: [],
            anagramas: [], 
            imagem: '',
            outrasimagens: [], 
            informacoes: {}
        };

        resultado.significado = $('.significado.textonovo').text().trim();

        $('.significado.textonovo > span:not(.etim)').each((i, el) => {
            const texto = $(el).text().trim();
            if (texto) {
                resultado.significados.push(texto);
            }
        });

        $('.adicional:not(.sinonimos)').each((i, el) => {
            const texto = $(el).text().trim();
            if (texto.includes('Classe gramatical:')) {
                resultado.classe = texto.match(/Classe gramatical:\s*(.+?)(?:\n|$)/)?.[1] || '';
                resultado.separacao = texto.match(/Separação silábica:\s*(.+?)(?:\n|$)/)?.[1] || '';
                resultado.plural = texto.match(/Plural:\s*(.+?)(?:\n|$)/)?.[1] || '';
            }
        });

        resultado.etimologia = $('.etim').text().trim();

        $('.adicional.sinonimos a').each((i, el) => {
            resultado.sinonimos.push($(el).text().trim());
        });

        $('.wrap-section').each((i, section) => {
            const titulo = $(section).find('h3').text().trim();
            if (titulo.includes('Antônimos')) {
                $(section).find('a').each((j, el) => {
                    resultado.antonimos.push($(el).text().trim());
                });
            }
        });

        $('.frases .frase').each((i, el) => {
            const frase = $(el).find('span').text().trim();
            const autor = $(el).find('em').last().text().trim();
            if (frase) {
                resultado.frases.push({
                    texto: frase.split('\n')[0],
                    autor: autor || 'Desconhecido'
                });
            }
        });

        $('.wrap-section').each((i, section) => {
            const titulo = $(section).find('h3').text().trim();
            if (titulo.includes('Exemplos')) {
                $(section).find('.frase').each((j, el) => {
                    const exemplo = $(el).text().trim();
                    const fonte = $(el).find('em').text().trim();
                    if (exemplo) {
                        resultado.exemplos.push({
                            texto: exemplo.replace(fonte, '').trim(),
                            fonte: fonte
                        });
                    }
                });
            }
        });

        $('.wrap-section').each((i, section) => {
            const titulo = $(section).find('h3').text().trim();
            if (titulo.includes('Rimas')) {
                $(section).find('a').each((j, el) => {
                    resultado.rimas.push($(el).text().trim());
                });
            }
        });

        $('.wrap-section').each((i, section) => {
            const titulo = $(section).find('h3').text().trim();
            if (titulo.includes('Anagramas')) {
                $(section).find('li').each((j, el) => {
                    resultado.anagramas.push($(el).text().trim());
                });
            }
        });

        resultado.imagem = $('.imagem-palavra').attr('src') || '';

        $('img[src*="amor"]').each((i, el) => {
            const src = $(el).attr('src');
            if (src && !resultado.imagem.includes(src)) {
                if (Array.isArray(resultado.outrasimagens)) {
                    resultado.outrasimagens.push(src);
                }
            }
        });
        
        return resultado;
        
    } catch (e) {
        console.error(e);
        return null;
    }
}

export default Dicionario;
export { Dicionario };