import { Meta } from '@/components/common/Meta';
import { usePageMeta } from '@/hooks/usePageMeta';

/**
 * PageMeta component to be included in each page to set the page-specific metadata
 */
export const PageMeta = () => {
  const { title, description, keywords, ogImage } = usePageMeta();

  return (
    <Meta
      title={title}
      description={description}
      keywords={keywords}
      ogImage={ogImage}
    />
  );
};
