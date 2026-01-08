import JSZip from 'jszip';
import yaml from 'js-yaml';

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
    
    // First pass: find and parse config files
    for (const [path, zipEntry] of entries) {
      if (zipEntry.dir) continue;
      
      const fileName = path.split('/').pop()?.toLowerCase() || '';
      const folderPath = path.split('/').slice(0, -1).join('/');
      
      if (fileName === '_meta.json' || fileName === 'meta.json') {
        const content = await zipEntry.async('string');
        const config = parseMetaJson(content);
        if (config) {
          if (folderPath === '' || path.split('/').length === 2) {
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
      
      const fileName = path.split('/').pop() || '';
      const ext = fileName.split('.').pop()?.toLowerCase();
      
      // Skip config files and non-markdown files
      if (['json', 'yml', 'yaml'].includes(ext || '')) continue;
      if (!['md', 'mdx', 'markdown'].includes(ext || '')) continue;
      
      try {
        const content = await zipEntry.async('string');
        
        // Normalize path (remove leading folder if all files are in one root folder)
        let normalizedPath = path;
        const firstFolder = path.split('/')[0];
        if (entries.every(([p]) => p.startsWith(firstFolder + '/') || p === firstFolder)) {
          normalizedPath = path.replace(firstFolder + '/', '');
        }
        
        // Calculate order from config
        const folderPath = normalizedPath.split('/').slice(0, -1).join('/');
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
            o === normalizedPath ||
            o === normalizedPath.replace(/\.(md|mdx|markdown)$/i, '')
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
        result.errors.push(`Failed to read ${path}`);
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
    result.errors.push(`Failed to read ZIP file: ${e instanceof Error ? e.message : 'Unknown error'}`);
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
  
  // First pass: find and parse config files
  for (const file of fileArray) {
    const path = file.webkitRelativePath || file.name;
    const fileName = path.split('/').pop()?.toLowerCase() || '';
    const folderPath = path.split('/').slice(0, -1).join('/');
    
    if (fileName === '_meta.json' || fileName === 'meta.json') {
      const content = await file.text();
      const config = parseMetaJson(content);
      if (config) {
        const depth = path.split('/').length;
        if (depth <= 2) {
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
  
  // Second pass: extract markdown files
  for (const file of fileArray) {
    const path = file.webkitRelativePath || file.name;
    const fileName = path.split('/').pop() || '';
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    // Skip config files and non-markdown files
    if (['json', 'yml', 'yaml'].includes(ext || '')) continue;
    if (!['md', 'mdx', 'markdown'].includes(ext || '')) continue;
    
    try {
      const content = await file.text();
      
      // Normalize path
      let normalizedPath = path;
      const firstFolder = path.split('/')[0];
      if (fileArray.every(f => {
        const p = f.webkitRelativePath || f.name;
        return p.startsWith(firstFolder + '/') || p === firstFolder;
      })) {
        normalizedPath = path.replace(firstFolder + '/', '');
      }
      
      const folderPath = normalizedPath.split('/').slice(0, -1).join('/');
      const baseName = fileName.replace(/\.(md|mdx|markdown)$/i, '');
      
      let order: number | undefined;
      let title: string | undefined;
      
      const folderConfig = result.folderConfigs.get(folderPath);
      if (folderConfig?.order) {
        const idx = folderConfig.order.findIndex(o => o === baseName || o === fileName);
        if (idx >= 0) order = idx;
      }
      if (folderConfig?.titles?.[baseName]) {
        title = folderConfig.titles[baseName];
      }
      
      if (order === undefined && result.rootConfig?.order) {
        const idx = result.rootConfig.order.findIndex(o => 
          o === baseName || o === fileName || o === normalizedPath
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
      result.errors.push(`Failed to read ${path}`);
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
