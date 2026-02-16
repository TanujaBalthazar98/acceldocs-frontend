import { useState } from "react";
import { ChevronDown, Plus, Search, FolderTree, MoreHorizontal, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  parent_id: string | null;
  is_published: boolean;
  drive_folder_id: string | null;
  visibility: "internal" | "external" | "public";
}

interface ProjectSwitcherProps {
  projects: Project[];
  selectedProject: Project | null;
  organizationSlug: string | null;
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
  onDeleteProject?: (project: Project) => void;
  collapsed?: boolean;
}

export const ProjectSwitcher = ({
  projects,
  selectedProject,
  organizationSlug,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  collapsed = false,
}: ProjectSwitcherProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter projects by search
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const dedupedProjects = filteredProjects.filter(
    (p, idx, arr) => arr.findIndex((other) => other.id === p.id) === idx
  );
  // Organize: root projects first, then sub-projects indented
  const rootProjects = dedupedProjects.filter((p) => !p.parent_id);
  const getSubProjects = (parentId: string) =>
    dedupedProjects.filter((p) => p.parent_id === parentId);

  // Get the base docs URL for the project
  const getProjectUrl = (project: Project) => {
    if (organizationSlug) {
      return `docs.${organizationSlug}/${project.name.toLowerCase().replace(/\s+/g, "-")}`;
    }
    return `docs/${project.id}`;
  };

  if (collapsed) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-10"
          >
            <FolderTree className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start" side="right">
          <ProjectList
            rootProjects={rootProjects}
            getSubProjects={getSubProjects}
            selectedProject={selectedProject}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            getProjectUrl={getProjectUrl}
            onSelectProject={(project) => {
              onSelectProject(project);
              setOpen(false);
            }}
            onCreateProject={() => {
              onCreateProject();
              setOpen(false);
            }}
            onDeleteProject={(project) => {
              onDeleteProject?.(project);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2.5 bg-secondary/50 hover:bg-secondary rounded-lg transition-colors text-left">
          <div className="flex items-center justify-center w-6 h-6 bg-primary rounded text-primary-foreground text-xs font-bold">
            {selectedProject?.name?.charAt(0).toUpperCase() || "P"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {selectedProject?.name || "Select Project"}
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" sideOffset={4}>
        <ProjectList
          rootProjects={rootProjects}
          getSubProjects={getSubProjects}
          selectedProject={selectedProject}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          getProjectUrl={getProjectUrl}
          onSelectProject={(project) => {
            onSelectProject(project);
            setOpen(false);
          }}
          onCreateProject={() => {
            onCreateProject();
            setOpen(false);
          }}
          onDeleteProject={(project) => {
            onDeleteProject?.(project);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

interface ProjectListProps {
  rootProjects: Project[];
  getSubProjects: (parentId: string) => Project[];
  selectedProject: Project | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  getProjectUrl: (project: Project) => string;
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
  onDeleteProject?: (project: Project) => void;
}

const ProjectList = ({
  rootProjects,
  getSubProjects,
  selectedProject,
  searchQuery,
  setSearchQuery,
  getProjectUrl,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
}: ProjectListProps) => {
  const renderProjectItem = (project: Project, isSubProject = false) => {
    const subProjects = getSubProjects(project.id);
    
    return (
      <div key={project.id}>
        <div
          onClick={() => onSelectProject(project)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/80 transition-colors text-left",
            selectedProject?.id === project.id && "bg-secondary",
            isSubProject && "pl-8"
          )}
        >
          <div className={cn(
            "flex items-center justify-center w-6 h-6 rounded text-xs font-bold shrink-0",
            isSubProject 
              ? "bg-primary/20 text-primary" 
              : "bg-primary text-primary-foreground"
          )}>
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">
              {project.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {getProjectUrl(project)}
            </p>
          </div>
          {project.is_published && (
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          )}
          {onDeleteProject && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground ml-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject(project);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {/* Render sub-projects */}
        {subProjects.map((subProject) => renderProjectItem(subProject, true))}
      </div>
    );
  };

  return (
    <div className="max-h-[400px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <p className="text-sm font-medium text-muted-foreground mb-3">
          Switch Project
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        {rootProjects.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {searchQuery ? "No matching projects" : "No projects yet"}
          </p>
        ) : (
          rootProjects.map((project) => renderProjectItem(project, false))
        )}
      </div>

      {/* Create new project */}
      <button
        onClick={onCreateProject}
        className="flex items-center gap-3 px-4 py-3 border-t border-border hover:bg-secondary/50 transition-colors"
      >
        <span className="text-sm font-medium text-foreground">
          Create New Project
        </span>
        <Plus className="w-4 h-4 text-muted-foreground ml-auto" />
      </button>
    </div>
  );
};
