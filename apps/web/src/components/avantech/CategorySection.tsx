import { cn } from '@/lib/utils';

type Props = {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
  className?: string;
};

export default function CategorySection({ id, title, count, children, className }: Props) {
  return (
    <section id={id} className={cn('scroll-mt-28', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground md:text-xl">{title}</h2>
        <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}
