import docspearelogo from "@/assets/docspeare-logo.png";

const Footer = () => {
  return (
    <footer className="py-12 border-t border-border">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center overflow-hidden">
              <img src={docspearelogo} alt="Docspeare" className="w-5 h-5 object-contain" />
            </div>
            <span className="text-lg font-semibold text-foreground">Docspeare</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Security
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Contact
            </a>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © 2025 Docspeare. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
