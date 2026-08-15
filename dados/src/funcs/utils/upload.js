import axios from 'axios';
import { getConfig } from '../../utils/gyomeiStore.js';

// --- CONFIGURAÇÃO ---
// Credenciais de upload (token do GitHub e repositório) vêm do config.json
// do servidor (upload_github_token / upload_github_repo), nunca do código —
// mesmo padrão já usado para site_vex/apikey_vex neste projeto. O token
// antigo (repo nazuninha/uploads, do criador original) parou de funcionar;
// o valor de referência atual é o usado no Nazuna oficial mantido ativamente
// (github.com/DevTokyoVx/nazuna), repo uploadsnew/uploads.
const FILE_TYPES = {
    fotos: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'ico', 'jfif', 'heic'],
    videos: ['mp4', 'avi', 'mkv', 'mov', 'webm', 'flv', 'wmv', 'mpeg', 'mpg'],
    audios: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma', 'midi'],
    documentos: ['pdf', 'doc', 'docx', 'xlsx', 'pptx', 'zip', 'rar', '7z', 'iso', 'apk', 'rtf', 'epub', 'txt', 'json', 'xml', 'csv', 'md', 'html', 'css', 'js', 'sql'],
};
const GITHUB_API_URL = 'https://api.github.com/repos';
const MAX_FILE_SIZE_MB = 50;
const DEFAULT_TIMEOUT_MS = 120000;

// --- OTIMIZAÇÃO: Mapa reverso para busca rápida de pastas ---
const EXTENSION_TO_FOLDER_MAP = new Map();
for (const [folder, extensions] of Object.entries(FILE_TYPES)) {
    for (const ext of extensions) {
        EXTENSION_TO_FOLDER_MAP.set(ext, folder);
    }
}

// --- DETECTOR DE TIPO DE ARQUIVO ---
class FileTypeDetector {
    static mimeCache = new Map();
    static SIGNATURES = {
        'ffd8ff': { ext: 'jpg', mime: 'image/jpeg' }, '89504e47': { ext: 'png', mime: 'image/png' }, '47494638': { ext: 'gif', mime: 'image/gif' }, '52494646': { handler: (b) => ({ '57454250': { ext: 'webp', mime: 'image/webp' }, '41564920': { ext: 'avi', mime: 'video/x-msvideo' }, '57415645': { ext: 'wav', mime: 'audio/wav' }})[b.toString('hex', 8, 12)] || { ext: 'bin', mime: 'application/octet-stream' }}, '49492a00': { ext: 'tiff', mime: 'image/tiff' }, '4d4d002a': { ext: 'tiff', mime: 'image/tiff' }, '1a45dfa3': { ext: 'mkv', mime: 'video/x-matroska' }, '424d': { ext: 'bmp', mime: 'image/bmp' }, '0000001c66747970': { handler: (b) => b.toString('hex', 16, 24) === '6d703432' ? {ext: 'm4a', mime: 'audio/mp4'} : { ext: 'mp4', mime: 'video/mp4' }}, '0000002066747970': { ext: 'mp4', mime: 'video/mp4' }, '4f676753': { ext: 'ogg', mime: 'audio/ogg' }, '494433': { ext: 'mp3', mime: 'audio/mpeg' }, '25504446': { ext: 'pdf', mime: 'application/pdf' }, '504b0304': { ext: 'zip', mime: 'application/zip' }, '526172211a0700': { ext: 'rar', mime: 'application/vnd.rar' }, '377abcaf271c': { ext: '7z', mime: 'application/x-7z-compressed' }, '4d5a': { ext: 'exe', mime: 'application/x-ms-download' }, '7b22': { ext: 'json', mime: 'application/json' }, '3c3f786d6c': { ext: 'xml', mime: 'application/xml' }, '3c21444f4354595045': { ext: 'html', mime: 'text/html' },
    };

    static detect(buffer) {
        if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
            return { ext: 'bin', mime: 'application/octet-stream' };
        }
        const cacheKey = buffer.toString('hex', 0, 12);
        if (this.mimeCache.has(cacheKey)) return this.mimeCache.get(cacheKey);

        for (let len = 16; len >= 2; len -= 2) {
             const hex = buffer.toString('hex', 0, len / 2);
             if (this.SIGNATURES[hex]) {
                 const sig = this.SIGNATURES[hex];
                 const result = typeof sig.handler === 'function' ? sig.handler(buffer) : sig;
                 if (result) { this.mimeCache.set(cacheKey, result); return result; }
             }
        }

        const textSample = buffer.toString('utf8', 0, 50).trim().toLowerCase();
        if (textSample.startsWith('<!doctype html') || textSample.startsWith('<html>')) return { ext: 'html', mime: 'text/html' };
        if (textSample.startsWith('<?xml')) return { ext: 'xml', mime: 'application/xml' };

        const fallbackResult = { ext: 'txt', mime: 'text/plain' };
        this.mimeCache.set(cacheKey, fallbackResult);
        return fallbackResult;
    }
}

class GitHubUploader {
    constructor(token, repo) {
        this.headers = { 'Accept': 'application/vnd.github.v3+json', 'Authorization': `Bearer ${token}` };
        this.apiUrl = `${GITHUB_API_URL}/${repo}/contents`;
    }
    async upload(buffer, filePath) {
        const base64Content = buffer.toString('base64');
        const response = await axios.put(`${this.apiUrl}/${filePath}`, { message: `Upload: ${filePath}`, content: base64Content }, { headers: this.headers, timeout: DEFAULT_TIMEOUT_MS });
        return response.data.content;
    }
    async delete(filePath, sha) {
        await axios.delete(`${this.apiUrl}/${filePath}`, { headers: this.headers, data: { message: `Delete: ${filePath}`, sha } });
    }
}

/**
 * Processa e faz o upload de um buffer para o GitHub.
 * @param {Buffer} buffer O buffer do arquivo a ser enviado.
 * @param {boolean} [deleteAfter10Min=false] Se o arquivo deve ser deletado após 10 minutos.
 * @returns {Promise<string>} A URL de download do arquivo.
 */
async function upload(buffer, deleteAfter10Min = false) {
    const config = getConfig();
    const token = String(config.upload_github_token || '').trim();
    const repo = String(config.upload_github_repo || '').trim();
    if (!token) throw new Error('Token do GitHub para upload não foi configurado (upload_github_token em config.json).');
    if (!repo) throw new Error('Repositório do GitHub para upload não foi configurado (upload_github_repo em config.json).');

    if (!Buffer.isBuffer(buffer)) throw new Error('Entrada inválida: O dado fornecido não é um Buffer.');
    const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (buffer.length > maxSizeBytes) throw new Error(`Arquivo muito grande. O limite é ${MAX_FILE_SIZE_MB}MB.`);

    const { ext } = FileTypeDetector.detect(buffer);
    const folder = EXTENSION_TO_FOLDER_MAP.get(ext) || 'outros';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `${folder}/${fileName}`;
    const uploader = new GitHubUploader(token, repo);

    try {
        const { download_url, sha } = await uploader.upload(buffer, filePath);
        if (!download_url) throw new Error('A API do GitHub não retornou uma URL de download.');

        if (deleteAfter10Min) {
            setTimeout(async () => {
                try {
                    await uploader.delete(filePath, sha);
                } catch (deleteError) {
                    console.error(`[Uploader] Falha ao deletar arquivo temporário ${filePath}:`, deleteError.message);
                }
            }, 10 * 60 * 1000);
        }
        return download_url;
    } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`Falha no upload para o GitHub: ${errorMessage}`);
    }
}

export default upload;
