import JSZip from 'jszip';
import yaml from 'js-yaml';

const normalizePath = (path: string): string =>
  path
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/');

export interface ImportedFile {
  path: string;
  content: string;
  order?: number;
  title?: string;
}

export interface ImportConfig {
  order?: string[];
  titles?: Record<string, string>;
  visibility?: Record<string, string>;
}

export interface ParsedImport {
  files: ImportedFile[];
  rootConfig: ImportConfig | null;
  folderConfigs: Map<string, ImportConfig>;
  errors: string[];
}

// Parse _meta.json config file
function parseMetaJson(content: string): ImportConfig | null {
  try {
    const meta = JSON.parse(content);
    return {
      order: meta.order || meta.pages || Object.keys(meta).filter(k => !['title', 'visibility'].includes(k)),
      titles: typeof meta === 'object' && !Array.isArray(meta) 
        ? Object.fromEntries(
            Object.entries(meta).filter(([_, v]) => typeof v === 'string')
          ) as Record<string, string>
        : meta.titles,
      visibility: meta.visibility,
    };
  } catch (e) {
    console.error('Failed to parse _meta.json:', e);
    return null;
  }
}

// Parse toc.yml config file  
function parseTocYaml(content: string): ImportConfig | null {
  try {
    const toc = yaml.load(content) as any;
    if (!toc) return null;
    
    const order: string[] = [];
    const titles: Record<string, string> = {};
    
    function extractItems(items: any[], prefix = '') {
      if (!Array.isArray(items)) return;
      
      for (const item of items) {
        if (typeof item === 'string') {
          order.push(prefix + item);
        } else if (typeof item === 'object') {
          const key = item.path || item.file || item.slug || Object.keys(item)[0];
          const title = item.title || item.name || item.label;
          
          if (key) {
            order.push(prefix + key);
            if (title) titles[key] = title;
          }
          
          // Handle nested items (groups/sections)
          if (item.items || item.pages || item.children) {
            extractItems(item.items || item.pages || item.children, prefix + (item.group || item.section || '') + '/');
          }
        }
      }
    }
    
    // Handle different toc.yml formats (Mintlify, GitBook, etc.)
    if (Array.isArray(toc)) {
      extractItems(toc);
    } else if (toc.navigation || toc.nav) {
      extractItems(toc.navigation || toc.nav);
    } else if (toc.pages) {
      extractItems(toc.pages);
    }
    
    return { order, titles };
  } catch (e) {
    console.error('Failed to parse toc.yml:', e);
    return null;
  }
}

// Extract and parse ZIP file
export async function parseZipFile(file: File): Promise<ParsedImport> {
  const result: ParsedImport = {
    files: [],
    rootConfig: null,
    folderConfigs: new Map(),
    errors: [],
  };
  
  try {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.entries(zip.files);
    const fileEntries = entries.filter(([, zipEntry]) => !zipEntry.dir);
    const entryPaths = fileEntries.map(([path]) => path);
    let commonRoot = '';

    if (entryPaths.length > 0) {
      const firstParts = entryPaths[0].split('/');
      if (firstParts.length > 1) {
        const potentialRoot = firstParts[0];
        const allShareRoot = entryPaths.every((p) => p.startsWith(potentialRoot + '/'));
        if (allShareRoot) {
          commonRoot = potentialRoot;
        }
      }
    }

    const stripCommonRoot = (path: string): string => {
      if (commonRoot && path.startsWith(commonRoot + '/')) {
        return path.slice(commonRoot.length + 1);
      }
      return path;
    };
    
    // First pass: find and parse config files
    for (const [path, zipEntry] of entries) {
      if (zipEntry.dir) continue;
      
      const configPath = stripCommonRoot(path);
      const fileName = configPath.split('/').pop()?.toLowerCase() || '';
      const folderPath = configPath.split('/').slice(0, -1).join('/');
      
      if (fileName === '_meta.json' || fileName === 'meta.json') {
        const content = await zipEntry.async('string');
        const config = parseMetaJson(content);
        if (config) {
          if (!folderPath || configPath.split('/').length <= 1) {
            result.rootConfig = config;
          } else {
            result.folderConfigs.set(folderPath, config);
          }
        }
      } else if (fileName === 'toc.yml' || fileName === 'toc.yaml' || fileName === '_toc.yml') {
        const content = await zipEntry.async('string');
        const config = parseTocYaml(content);
        if (config) {
          if (folderPath === '' || path.split('/').length === 2) {
            result.rootConfig = config;
          }
        }
      } else if (fileName === 'mint.json') {
        // Mintlify config support
        const content = await zipEntry.async('string');
        try {
          const mintConfig = JSON.parse(content);
          if (mintConfig.navigation) {
            const order: string[] = [];
            const titles: Record<string, string> = {};
            
            for (const group of mintConfig.navigation) {
              if (group.pages) {
                for (const page of group.pages) {
                  if (typeof page === 'string') {
                    order.push(page);
                  } else if (page.page) {
                    order.push(page.page);
                    if (page.title) titles[page.page] = page.title;
                  }
                }
              }
            }
            
            result.rootConfig = { order, titles };
          }
        } catch (e) {
          result.errors.push('Failed to parse mint.json');
        }
      }
    }
    
    // Second pass: extract markdown files
    for (const [path, zipEntry] of entries) {
      if (zipEntry.dir) continue;
      
      const normalizedPath = normalizePath(path);
      const configPath = stripCommonRoot(normalizedPath);
      const fileName = normalizedPath.split('/').pop() || '';
      const ext = fileName.split('.').pop()?.toLowerCase();
      
      // Skip config files and non-markdown files
      if (['json', 'yml', 'yaml'].includes(ext || '')) continue;
      if (!['md', 'mdx', 'markdown'].includes(ext || '')) continue;
      
      try {
        const content = await zipEntry.async('string');
        
        // Calculate order from config
        const folderPath = configPath.split('/').slice(0, -1).join('/');
        const baseName = fileName.replace(/\.(md|mdx|markdown)$/i, '');
        
        let order: number | undefined;
        let title: string | undefined;
        
        // Check folder-level config
        const folderConfig = result.folderConfigs.get(folderPath);
        if (folderConfig?.order) {
          const idx = folderConfig.order.findIndex(o => 
            o === baseName || o === fileName || o.endsWith('/' + baseName)
          );
          if (idx >= 0) order = idx;
        }
        if (folderConfig?.titles?.[baseName]) {
          title = folderConfig.titles[baseName];
        }
        
        // Check root config if no folder config
        if (order === undefined && result.rootConfig?.order) {
          const idx = result.rootConfig.order.findIndex(o => 
            o === baseName || 
            o === fileName || 
            o === configPath ||
            o === configPath.replace(/\.(md|mdx|markdown)$/i, '')
          );
          if (idx >= 0) order = idx;
        }
        if (!title && result.rootConfig?.titles?.[baseName]) {
          title = result.rootConfig.titles[baseName];
        }
        
        result.files.push({
          path: normalizedPath,
          content,
          order,
          title,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        result.errors.push(`Failed to read ${path}: ${message}`);
      }
    }
    
    // Sort files by order, then alphabetically
    result.files.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return a.path.localeCompare(b.path);
    });
    
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    result.errors.push(`Failed to read ZIP file: ${message}`);
  }
  
  return result;
}

// Parse folder from file input (webkitdirectory)
export async function parseFolderFiles(files: FileList): Promise<ParsedImport> {
  const result: ParsedImport = {
    files: [],
    rootConfig: null,
    folderConfigs: new Map(),
    errors: [],
  };
  
  const fileArray = Array.from(files);
  
  // Determine root folder for config lookups (common prefix)
  const firstPath = fileArray[0]?.webkitRelativePath || fileArray[0]?.name || '';
  const rootFolder = firstPath.split('/')[0];
  const allInSameRoot = fileArray.every(f => {
    const p = f.webkitRelativePath || f.name;
    return p.startsWith(rootFolder + '/') || p === rootFolder;
  });
  
  const normalizeConfigPath = (path: string): string => {
    if (allInSameRoot && path.startsWith(rootFolder + '/')) {
      return path.slice(rootFolder.length + 1);
    }
    return path;
  };
  
  // First pass: find and parse config files with NORMALIZED paths
  for (const file of fileArray) {
    const rawPath = file.webkitRelativePath || file.name;
    const configPath = normalizeConfigPath(rawPath);
    const fileName = configPath.split('/').pop()?.toLowerCase() || '';
    const folderPath = configPath.split('/').slice(0, -1).join('/');
    
    if (fileName === '_meta.json' || fileName === 'meta.json') {
      const content = await file.text();
      const config = parseMetaJson(content);
      if (config) {
        // Root level if no folder path after normalization
        if (!folderPath || configPath.split('/').length <= 1) {
          result.rootConfig = config;
        } else {
          result.folderConfigs.set(folderPath, config);
        }
      }
    } else if (fileName === 'toc.yml' || fileName === 'toc.yaml' || fileName === '_toc.yml') {
      const content = await file.text();
      const config = parseTocYaml(content);
      if (config) {
        result.rootConfig = config;
      }
    }
  }
  
  // Second pass: extract markdown files with consistent path normalization
  for (const file of fileArray) {
    const rawPath = file.webkitRelativePath || file.name;
    const fileName = rawPath.split('/').pop() || '';
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    // Skip config files and non-markdown files
    if (['json', 'yml', 'yaml'].includes(ext || '')) continue;
    if (!['md', 'mdx', 'markdown'].includes(ext || '')) continue;
    
    try {
      const content = await file.text();
      
      const importPath = rawPath.replace(/\\/g, '/');
      const configPath = normalizeConfigPath(rawPath);
      const folderPath = configPath.split('/').slice(0, -1).join('/');
      const baseName = fileName.replace(/\.(md|mdx|markdown)$/i, '');
      
      let order: number | undefined;
      let title: string | undefined;
      
      // Check folder-level config using normalized path
      const folderConfig = result.folderConfigs.get(folderPath);
      if (folderConfig?.order) {
        const idx = folderConfig.order.findIndex(o => o === baseName || o === fileName);
        if (idx >= 0) order = idx;
      }
      if (folderConfig?.titles?.[baseName]) {
        title = folderConfig.titles[baseName];
      }
      
      // Check root config if no folder config
      if (order === undefined && result.rootConfig?.order) {
        const idx = result.rootConfig.order.findIndex(o => 
          o === baseName || o === fileName || o === configPath
        );
        if (idx >= 0) order = idx;
      }
      if (!title && result.rootConfig?.titles?.[baseName]) {
        title = result.rootConfig.titles[baseName];
      }
      
      result.files.push({
        path: importPath,
        content,
        order,
        title,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      result.errors.push(`Failed to read ${rawPath}: ${message}`);
    }
  }
  
  result.files.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    return a.path.localeCompare(b.path);
  });
  
  return result;
}
