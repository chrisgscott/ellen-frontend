'use client';

import { useState } from 'react';
import { NewsFeedSidebar, NewsItem } from '@/components/newsfeed-sidebar';
import { ArticleView } from '@/components/article-view';



export default function NewsPage() {
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  return (
    <div className="flex h-full w-full">
      <div className="w-[400px] border-r border-border overflow-y-auto">
        <NewsFeedSidebar onItemClick={setSelectedArticle} />
      </div>
      <ArticleView article={selectedArticle} />
    </div>
  );
}
