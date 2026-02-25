export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-16">
      <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-gray-600">
        <p className="text-center md:text-left">
          © {new Date().getFullYear()} Idest. All rights reserved.
        </p>
        <div className="flex justify-center gap-4">
          <a
            href="https://github.com/LuckiPhoenix"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gray-900 transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/chihenhuynh/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gray-900 transition-colors"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}



