import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface RawColumn {
    column_name: string;
    data_type: string;
}

interface FormattedColumn {
    value: string;
    label: string;
    type: 'number' | 'text';
}

function formatColumnName(columnName: string): string {
    return columnName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export async function GET() {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase.rpc('get_table_columns', { p_table_name: 'materials' });

        if (error) {
            console.error('Error fetching schema from Supabase:', error);
            throw new Error(error.message);
        }

        if (data) {
            const formattedColumns: FormattedColumn[] = data
                .map((col: RawColumn): FormattedColumn | null => {
                    const colName = col.column_name;
                    const dataType = col.data_type;

                    if (['uuid', 'jsonb', 'timestamp with time zone', 'ARRAY'].includes(dataType)) {
                        return null;
                    }

                    const filterType = ['integer', 'bigint', 'numeric', 'double precision'].some(t =>
                        dataType.includes(t)
                    )
                        ? 'number'
                        : 'text';

                    return {
                        value: colName,
                        label: formatColumnName(colName),
                        type: filterType,
                    };
                })
                .filter((col: FormattedColumn | null): col is FormattedColumn => col !== null);

            return NextResponse.json(formattedColumns.sort((a, b) => a.label.localeCompare(b.label)));
        }

        return NextResponse.json([], { status: 404 });
    } catch (e: any) {
        console.error('API Route Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
