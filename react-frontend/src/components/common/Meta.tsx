interface MetaProps {
  title?: string;
  description?: string;
  keywords?: string;
  author?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  canonicalUrl?: string;
}

export const Meta = ({
  title = 'FastAPI RBAC',
  description = 'A Role-Based Access Control application built with FastAPI and React',
  keywords = 'RBAC, user management, role-based access control, authentication, authorization',
  author = 'Your Company',
  ogTitle = title,
  ogDescription = description,
  ogImage = '/logo.png',
  ogUrl = window.location.href,
  twitterCard = 'summary_large_image',
  twitterTitle = title,
  twitterDescription = description,
  twitterImage = '/logo.png',
  canonicalUrl = window.location.href,
}: MetaProps) => {
  // Get the app name from environment variable
  const appName = import.meta.env.VITE_APP_NAME || 'FastAPI RBAC';
  const fullTitle = `${title} | ${appName}`;

  return (
    <>
      {/* React 19 native document metadata */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={ogUrl} />
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={ogDescription} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={twitterTitle} />
      <meta name="twitter:description" content={twitterDescription} />
      <meta name="twitter:image" content={twitterImage} />

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
    </>
  );
};
