import React, { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import FileExplorer from './FileExplorer';
import './markdown.css';

type File = {
    name: string;
    path: string;
    type: 'file' | 'dir';
    download_url?: string;
};

const NoteViewer: React.FC = () => {
    const [content, setContent] = useState<string | null>(null);
    const [plotImageUrl, setPlotImageUrl] = useState<string | null>(null);

    const fetchNoteContent = async (downloadUrl: string) => {
        try {
            const response = await axios.get(downloadUrl);
            const content = response.data;
            setContent(content);

            if (content.includes("$$plot")) {
                generatePlot();
            }
        } catch (error) {
            console.error('Failed to fetch note:', error);
        }
    };

    const handleSelectFile = (file: File) => {
        if (file.download_url) {
            fetchNoteContent(file.download_url);
        }
    };

    const generatePlot = () => {
        const imageUrl = "https://quicklatex.com/cache3/34/ql_9c0dfda33fbf0f2ae1e5ed1476b3e234_l3.png";
        setPlotImageUrl(imageUrl);
    };

    return (
        <div style={{ display: 'flex' }}>
            <div style={{ width: '30%', borderRight: '1px solid #ddd', padding: '10px' }}>
                <h2>Lista plików</h2>
                <FileExplorer onSelectFile={handleSelectFile} /> {/* Poprawiony props */}
            </div>
            <div style={{ width: '70%', padding: '10px' }}>
                {plotImageUrl && <img src={plotImageUrl} alt="Function Plot" style={{ width: '100%', marginBottom: '20px' }} />}
                {content ? (
                    <ReactMarkdown
                        className="markdown-body"
                        children={content}
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                    />
                ) : (
                    <p>Wybierz plik, aby wyświetlić jego zawartość.</p>
                )}
            </div>
        </div>
    );
};

export default NoteViewer;
