import React, { useState, useEffect } from 'react'; 
import axios from 'axios';

type File = {
    name: string;
    path: string;
    type: 'file' | 'dir';
    download_url?: string;
};

type FileExplorerProps = {
    onSelectFile: (file: File) => void;
};

const FileExplorer: React.FC<FileExplorerProps> = ({ onSelectFile }) => {
    const [files, setFiles] = useState<Record<string, File[]>>({});
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

    useEffect(() => {
        // Pobierz zawartość początkowego katalogu "OSDEV/OSDEV_PDF" po załadowaniu komponentu
        fetchFiles('OSDEV/OSDEV_PDF');
    }, []);

    const fetchFiles = async (path: string) => {
        try {
            const response = await axios.get(
                `https://api.github.com/repos/majster247/let-him-cook--kernel-/contents/${path}`
            );
            setFiles((prevFiles) => ({
                ...prevFiles,
                [path]: response.data
            }));
        } catch (error) {
            console.error('Failed to fetch files:', error);
        }
    };

    const handleFolderClick = (file: File) => {
        if (expandedFolders[file.path]) {
            setExpandedFolders((prev) => ({ ...prev, [file.path]: false }));
        } else {
            setExpandedFolders((prev) => ({ ...prev, [file.path]: true }));
            if (!files[file.path]) {
                fetchFiles(file.path); // Pobierz pliki tylko jeśli wcześniej nie były pobierane
            }
        }
    };

    const renderFiles = (path: string, level: number = 0) => {
        const currentFiles = files[path] || [];
        return currentFiles.map((file) => (
            <div key={file.path} style={{ paddingLeft: `${level * 20}px` }}>
                {file.type === 'dir' ? (
                    <div onClick={() => handleFolderClick(file)} style={{ cursor: 'pointer' }}>
                        {expandedFolders[file.path] ? '📂' : '📁'} {file.name}
                    </div>
                ) : (
                    <div onClick={() => onSelectFile(file)} style={{ cursor: 'pointer' }}>
                        📄 {file.name}
                    </div>
                )}
                {file.type === 'dir' && expandedFolders[file.path] && renderFiles(file.path, level + 1)}
            </div>
        ));
    };

    return <div>{renderFiles('OSDEV/OSDEV_PDF')}</div>;
};

export default FileExplorer;
