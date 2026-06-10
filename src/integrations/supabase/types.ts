export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          created_at: string;
          entity: string | null;
          entity_id: string | null;
          id: string;
          ip: string | null;
          metadata: Json;
          tenant_id: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          ip?: string | null;
          metadata?: Json;
          tenant_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          ip?: string | null;
          metadata?: Json;
          tenant_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      buscas_salvas: {
        Row: {
          alerta_email: boolean;
          created_at: string;
          filtros: Json;
          id: string;
          nome: string;
          ultimo_envio: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          alerta_email?: boolean;
          created_at?: string;
          filtros?: Json;
          id?: string;
          nome: string;
          ultimo_envio?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          alerta_email?: boolean;
          created_at?: string;
          filtros?: Json;
          id?: string;
          nome?: string;
          ultimo_envio?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      cartorio_registros: {
        Row: {
          arquivo_url: string | null;
          cartorio_nome: string | null;
          cidade: string | null;
          contrato_id: string | null;
          created_at: string;
          created_by: string | null;
          custas: number | null;
          data_protocolo: string | null;
          data_registro: string | null;
          id: string;
          imovel_id: string | null;
          observacoes: string | null;
          protocolo: string | null;
          status: string;
          tenant_id: string;
          tipo: string;
          uf: string | null;
          updated_at: string;
        };
        Insert: {
          arquivo_url?: string | null;
          cartorio_nome?: string | null;
          cidade?: string | null;
          contrato_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          custas?: number | null;
          data_protocolo?: string | null;
          data_registro?: string | null;
          id?: string;
          imovel_id?: string | null;
          observacoes?: string | null;
          protocolo?: string | null;
          status?: string;
          tenant_id: string;
          tipo: string;
          uf?: string | null;
          updated_at?: string;
        };
        Update: {
          arquivo_url?: string | null;
          cartorio_nome?: string | null;
          cidade?: string | null;
          contrato_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          custas?: number | null;
          data_protocolo?: string | null;
          data_registro?: string | null;
          id?: string;
          imovel_id?: string | null;
          observacoes?: string | null;
          protocolo?: string | null;
          status?: string;
          tenant_id?: string;
          tipo?: string;
          uf?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cartorio_registros_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cartorio_registros_imovel_id_fkey";
            columns: ["imovel_id"];
            isOneToOne: false;
            referencedRelation: "imoveis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cartorio_registros_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      centros_custo: {
        Row: {
          ativo: boolean;
          codigo: string;
          created_at: string;
          id: string;
          nome: string;
          tenant_id: string;
        };
        Insert: {
          ativo?: boolean;
          codigo: string;
          created_at?: string;
          id?: string;
          nome: string;
          tenant_id: string;
        };
        Update: {
          ativo?: boolean;
          codigo?: string;
          created_at?: string;
          id?: string;
          nome?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "centros_custo_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_conversations: {
        Row: {
          assunto: string | null;
          corretor_user_id: string | null;
          created_at: string;
          id: string;
          imovel_id: string;
          interessado_user_id: string;
          last_message_at: string;
          last_message_preview: string | null;
          last_sender_role: string | null;
          tenant_id: string;
          unread_corretor: number;
          unread_interessado: number;
          updated_at: string;
        };
        Insert: {
          assunto?: string | null;
          corretor_user_id?: string | null;
          created_at?: string;
          id?: string;
          imovel_id: string;
          interessado_user_id: string;
          last_message_at?: string;
          last_message_preview?: string | null;
          last_sender_role?: string | null;
          tenant_id: string;
          unread_corretor?: number;
          unread_interessado?: number;
          updated_at?: string;
        };
        Update: {
          assunto?: string | null;
          corretor_user_id?: string | null;
          created_at?: string;
          id?: string;
          imovel_id?: string;
          interessado_user_id?: string;
          last_message_at?: string;
          last_message_preview?: string | null;
          last_sender_role?: string | null;
          tenant_id?: string;
          unread_corretor?: number;
          unread_interessado?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          kind: string;
          read_at: string | null;
          sender_role: string;
          sender_user_id: string;
          tenant_id: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          kind?: string;
          read_at?: string | null;
          sender_role: string;
          sender_user_id: string;
          tenant_id: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          read_at?: string | null;
          sender_role?: string;
          sender_user_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "chat_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_quick_replies: {
        Row: {
          ativo: boolean;
          content: string;
          created_at: string;
          id: string;
          label: string;
          ordem: number;
          tenant_id: string;
        };
        Insert: {
          ativo?: boolean;
          content: string;
          created_at?: string;
          id?: string;
          label: string;
          ordem?: number;
          tenant_id: string;
        };
        Update: {
          ativo?: boolean;
          content?: string;
          created_at?: string;
          id?: string;
          label?: string;
          ordem?: number;
          tenant_id?: string;
        };
        Relationships: [];
      };
      checklist_template_itens: {
        Row: {
          etapa: string;
          id: string;
          obrigatorio: boolean;
          ordem: number;
          template_id: string;
          tenant_id: string;
          titulo: string;
        };
        Insert: {
          etapa: string;
          id?: string;
          obrigatorio?: boolean;
          ordem?: number;
          template_id: string;
          tenant_id: string;
          titulo: string;
        };
        Update: {
          etapa?: string;
          id?: string;
          obrigatorio?: boolean;
          ordem?: number;
          template_id?: string;
          tenant_id?: string;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checklist_template_itens_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "checklist_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      checklist_templates: {
        Row: {
          ativo: boolean;
          created_at: string;
          id: string;
          nome: string;
          tenant_id: string;
          tipo: string;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          id?: string;
          nome: string;
          tenant_id: string;
          tipo?: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          id?: string;
          nome?: string;
          tenant_id?: string;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checklist_templates_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      comissoes: {
        Row: {
          contrato_id: string | null;
          corretor_id: string;
          created_at: string;
          created_by: string | null;
          data_pagamento: string | null;
          data_prevista: string | null;
          id: string;
          lancamento_id: string | null;
          observacoes: string | null;
          percentual: number | null;
          status: Database["public"]["Enums"]["comissao_status"];
          tenant_id: string;
          updated_at: string;
          valor: number;
        };
        Insert: {
          contrato_id?: string | null;
          corretor_id: string;
          created_at?: string;
          created_by?: string | null;
          data_pagamento?: string | null;
          data_prevista?: string | null;
          id?: string;
          lancamento_id?: string | null;
          observacoes?: string | null;
          percentual?: number | null;
          status?: Database["public"]["Enums"]["comissao_status"];
          tenant_id: string;
          updated_at?: string;
          valor?: number;
        };
        Update: {
          contrato_id?: string | null;
          corretor_id?: string;
          created_at?: string;
          created_by?: string | null;
          data_pagamento?: string | null;
          data_prevista?: string | null;
          id?: string;
          lancamento_id?: string | null;
          observacoes?: string | null;
          percentual?: number | null;
          status?: Database["public"]["Enums"]["comissao_status"];
          tenant_id?: string;
          updated_at?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "comissoes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comissoes_corretor_id_fkey";
            columns: ["corretor_id"];
            isOneToOne: false;
            referencedRelation: "corretores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comissoes_lancamento_id_fkey";
            columns: ["lancamento_id"];
            isOneToOne: false;
            referencedRelation: "lancamentos_financeiros";
            referencedColumns: ["id"];
          },
        ];
      };
      contrato_checklist: {
        Row: {
          concluido: boolean;
          concluido_em: string | null;
          concluido_por: string | null;
          contrato_id: string;
          created_at: string;
          etapa: string;
          id: string;
          obrigatorio: boolean;
          observacoes: string | null;
          ordem: number;
          tenant_id: string;
          titulo: string;
        };
        Insert: {
          concluido?: boolean;
          concluido_em?: string | null;
          concluido_por?: string | null;
          contrato_id: string;
          created_at?: string;
          etapa: string;
          id?: string;
          obrigatorio?: boolean;
          observacoes?: string | null;
          ordem?: number;
          tenant_id: string;
          titulo: string;
        };
        Update: {
          concluido?: boolean;
          concluido_em?: string | null;
          concluido_por?: string | null;
          contrato_id?: string;
          created_at?: string;
          etapa?: string;
          id?: string;
          obrigatorio?: boolean;
          observacoes?: string | null;
          ordem?: number;
          tenant_id?: string;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contrato_checklist_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contrato_checklist_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      contrato_partes: {
        Row: {
          contrato_id: string;
          created_at: string;
          documento: string | null;
          email: string | null;
          id: string;
          nome: string;
          papel: Database["public"]["Enums"]["parte_papel"];
          telefone: string | null;
          tenant_id: string;
        };
        Insert: {
          contrato_id: string;
          created_at?: string;
          documento?: string | null;
          email?: string | null;
          id?: string;
          nome: string;
          papel: Database["public"]["Enums"]["parte_papel"];
          telefone?: string | null;
          tenant_id: string;
        };
        Update: {
          contrato_id?: string;
          created_at?: string;
          documento?: string | null;
          email?: string | null;
          id?: string;
          nome?: string;
          papel?: Database["public"]["Enums"]["parte_papel"];
          telefone?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contrato_partes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id"];
          },
        ];
      };
      contrato_templates: {
        Row: {
          ativo: boolean;
          conteudo: string;
          created_at: string;
          created_by: string | null;
          id: string;
          nome: string;
          tenant_id: string;
          tipo: Database["public"]["Enums"]["contrato_tipo"];
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          conteudo?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          nome: string;
          tenant_id: string;
          tipo?: Database["public"]["Enums"]["contrato_tipo"];
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          conteudo?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          nome?: string;
          tenant_id?: string;
          tipo?: Database["public"]["Enums"]["contrato_tipo"];
          updated_at?: string;
        };
        Relationships: [];
      };
      contratos: {
        Row: {
          arquivo_path: string | null;
          comissao_percentual: number | null;
          comissao_valor: number | null;
          corretor_id: string | null;
          created_at: string;
          created_by: string | null;
          data_fim: string | null;
          data_inicio: string | null;
          id: string;
          imovel_id: string | null;
          lead_id: string | null;
          numero: string | null;
          observacoes: string | null;
          status: Database["public"]["Enums"]["contrato_status"];
          tenant_id: string;
          tipo: Database["public"]["Enums"]["contrato_tipo"];
          updated_at: string;
          valor: number;
        };
        Insert: {
          arquivo_path?: string | null;
          comissao_percentual?: number | null;
          comissao_valor?: number | null;
          corretor_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_fim?: string | null;
          data_inicio?: string | null;
          id?: string;
          imovel_id?: string | null;
          lead_id?: string | null;
          numero?: string | null;
          observacoes?: string | null;
          status?: Database["public"]["Enums"]["contrato_status"];
          tenant_id: string;
          tipo?: Database["public"]["Enums"]["contrato_tipo"];
          updated_at?: string;
          valor?: number;
        };
        Update: {
          arquivo_path?: string | null;
          comissao_percentual?: number | null;
          comissao_valor?: number | null;
          corretor_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_fim?: string | null;
          data_inicio?: string | null;
          id?: string;
          imovel_id?: string | null;
          lead_id?: string | null;
          numero?: string | null;
          observacoes?: string | null;
          status?: Database["public"]["Enums"]["contrato_status"];
          tenant_id?: string;
          tipo?: Database["public"]["Enums"]["contrato_tipo"];
          updated_at?: string;
          valor?: number;
        };
        Relationships: [];
      };
      corretores: {
        Row: {
          ativo: boolean;
          bio: string | null;
          cargo: string | null;
          comissao_padrao: number | null;
          created_at: string;
          creci: string | null;
          creci_uf: string | null;
          email: string | null;
          foto_url: string | null;
          id: string;
          nome: string;
          publico: boolean;
          slug: string;
          telefone: string | null;
          tenant_id: string;
          updated_at: string;
          user_id: string | null;
          whatsapp: string | null;
        };
        Insert: {
          ativo?: boolean;
          bio?: string | null;
          cargo?: string | null;
          comissao_padrao?: number | null;
          created_at?: string;
          creci?: string | null;
          creci_uf?: string | null;
          email?: string | null;
          foto_url?: string | null;
          id?: string;
          nome: string;
          publico?: boolean;
          slug: string;
          telefone?: string | null;
          tenant_id: string;
          updated_at?: string;
          user_id?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          ativo?: boolean;
          bio?: string | null;
          cargo?: string | null;
          comissao_padrao?: number | null;
          created_at?: string;
          creci?: string | null;
          creci_uf?: string | null;
          email?: string | null;
          foto_url?: string | null;
          id?: string;
          nome?: string;
          publico?: boolean;
          slug?: string;
          telefone?: string | null;
          tenant_id?: string;
          updated_at?: string;
          user_id?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      email_send_log: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          message_id: string | null;
          metadata: Json | null;
          recipient_email: string;
          status: string;
          template_name: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          message_id?: string | null;
          metadata?: Json | null;
          recipient_email: string;
          status: string;
          template_name: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          message_id?: string | null;
          metadata?: Json | null;
          recipient_email?: string;
          status?: string;
          template_name?: string;
        };
        Relationships: [];
      };
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number;
          batch_size: number;
          id: number;
          retry_after_until: string | null;
          send_delay_ms: number;
          transactional_email_ttl_minutes: number;
          updated_at: string;
        };
        Insert: {
          auth_email_ttl_minutes?: number;
          batch_size?: number;
          id?: number;
          retry_after_until?: string | null;
          send_delay_ms?: number;
          transactional_email_ttl_minutes?: number;
          updated_at?: string;
        };
        Update: {
          auth_email_ttl_minutes?: number;
          batch_size?: number;
          id?: number;
          retry_after_until?: string | null;
          send_delay_ms?: number;
          transactional_email_ttl_minutes?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_unsubscribe_tokens: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          token: string;
          used_at: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          token: string;
          used_at?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          token?: string;
          used_at?: string | null;
        };
        Relationships: [];
      };
      empreendimento_reservas: {
        Row: {
          corretor_id: string | null;
          created_at: string;
          id: string;
          lead_id: string | null;
          observacoes: string | null;
          status: string;
          tenant_id: string;
          unidade_id: string;
          updated_at: string;
          validade: string;
        };
        Insert: {
          corretor_id?: string | null;
          created_at?: string;
          id?: string;
          lead_id?: string | null;
          observacoes?: string | null;
          status?: string;
          tenant_id: string;
          unidade_id: string;
          updated_at?: string;
          validade: string;
        };
        Update: {
          corretor_id?: string | null;
          created_at?: string;
          id?: string;
          lead_id?: string | null;
          observacoes?: string | null;
          status?: string;
          tenant_id?: string;
          unidade_id?: string;
          updated_at?: string;
          validade?: string;
        };
        Relationships: [
          {
            foreignKeyName: "empreendimento_reservas_corretor_id_fkey";
            columns: ["corretor_id"];
            isOneToOne: false;
            referencedRelation: "corretores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "empreendimento_reservas_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "empreendimento_reservas_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "empreendimento_reservas_unidade_id_fkey";
            columns: ["unidade_id"];
            isOneToOne: false;
            referencedRelation: "empreendimento_unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      empreendimento_unidades: {
        Row: {
          andar: number | null;
          area: number | null;
          bloco: string | null;
          created_at: string;
          empreendimento_id: string;
          id: string;
          numero: string;
          observacoes: string | null;
          preco: number | null;
          quartos: number | null;
          status: string;
          suites: number | null;
          tenant_id: string;
          tipo_planta: string | null;
          updated_at: string;
          vagas: number | null;
        };
        Insert: {
          andar?: number | null;
          area?: number | null;
          bloco?: string | null;
          created_at?: string;
          empreendimento_id: string;
          id?: string;
          numero: string;
          observacoes?: string | null;
          preco?: number | null;
          quartos?: number | null;
          status?: string;
          suites?: number | null;
          tenant_id: string;
          tipo_planta?: string | null;
          updated_at?: string;
          vagas?: number | null;
        };
        Update: {
          andar?: number | null;
          area?: number | null;
          bloco?: string | null;
          created_at?: string;
          empreendimento_id?: string;
          id?: string;
          numero?: string;
          observacoes?: string | null;
          preco?: number | null;
          quartos?: number | null;
          status?: string;
          suites?: number | null;
          tenant_id?: string;
          tipo_planta?: string | null;
          updated_at?: string;
          vagas?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "empreendimento_unidades_empreendimento_id_fkey";
            columns: ["empreendimento_id"];
            isOneToOne: false;
            referencedRelation: "empreendimentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "empreendimento_unidades_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      empreendimentos: {
        Row: {
          cnpj_construtora: string | null;
          construtora: string | null;
          created_at: string;
          descricao: string | null;
          endereco_bairro: string | null;
          endereco_cep: string | null;
          endereco_cidade: string | null;
          endereco_logradouro: string | null;
          endereco_numero: string | null;
          endereco_uf: string | null;
          entrega_prevista: string | null;
          fase: string;
          fotos_urls: string[];
          id: string;
          latitude: number | null;
          longitude: number | null;
          nome: string;
          publicado: boolean;
          slug: string;
          tenant_id: string;
          unidades_total: number | null;
          updated_at: string;
        };
        Insert: {
          cnpj_construtora?: string | null;
          construtora?: string | null;
          created_at?: string;
          descricao?: string | null;
          endereco_bairro?: string | null;
          endereco_cep?: string | null;
          endereco_cidade?: string | null;
          endereco_logradouro?: string | null;
          endereco_numero?: string | null;
          endereco_uf?: string | null;
          entrega_prevista?: string | null;
          fase?: string;
          fotos_urls?: string[];
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          nome: string;
          publicado?: boolean;
          slug: string;
          tenant_id: string;
          unidades_total?: number | null;
          updated_at?: string;
        };
        Update: {
          cnpj_construtora?: string | null;
          construtora?: string | null;
          created_at?: string;
          descricao?: string | null;
          endereco_bairro?: string | null;
          endereco_cep?: string | null;
          endereco_cidade?: string | null;
          endereco_logradouro?: string | null;
          endereco_numero?: string | null;
          endereco_uf?: string | null;
          entrega_prevista?: string | null;
          fase?: string;
          fotos_urls?: string[];
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          nome?: string;
          publicado?: boolean;
          slug?: string;
          tenant_id?: string;
          unidades_total?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "empreendimentos_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      favoritos: {
        Row: {
          created_at: string;
          id: string;
          imovel_id: string;
          pasta: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          imovel_id: string;
          pasta?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          imovel_id?: string;
          pasta?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      global_settings: {
        Row: {
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value?: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      imoveis: {
        Row: {
          aceita_financiamento: boolean;
          aceita_permuta: boolean;
          area_total: number | null;
          area_util: number | null;
          banheiros: number | null;
          caracteristicas: string[];
          codigo_interno: string | null;
          condominio: number | null;
          corretor_responsavel_id: string | null;
          created_at: string;
          created_by: string | null;
          custom_data: Json;
          descricao: string | null;
          destaque: boolean;
          endereco_bairro: string | null;
          endereco_cep: string | null;
          endereco_cidade: string | null;
          endereco_complemento: string | null;
          endereco_logradouro: string | null;
          endereco_numero: string | null;
          endereco_uf: string | null;
          finalidade: Database["public"]["Enums"]["imovel_finalidade"];
          id: string;
          iptu: number | null;
          latitude: number | null;
          longitude: number | null;
          mostrar_endereco_publico: boolean;
          preco: number;
          preco_anterior: number | null;
          publicado: boolean;
          publicado_em: string | null;
          quartos: number | null;
          selos: string[];
          slug: string;
          status: Database["public"]["Enums"]["imovel_status"];
          suites: number | null;
          tenant_id: string;
          tipo: Database["public"]["Enums"]["imovel_tipo"];
          titulo: string;
          updated_at: string;
          vagas: number | null;
        };
        Insert: {
          aceita_financiamento?: boolean;
          aceita_permuta?: boolean;
          area_total?: number | null;
          area_util?: number | null;
          banheiros?: number | null;
          caracteristicas?: string[];
          codigo_interno?: string | null;
          condominio?: number | null;
          corretor_responsavel_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          custom_data?: Json;
          descricao?: string | null;
          destaque?: boolean;
          endereco_bairro?: string | null;
          endereco_cep?: string | null;
          endereco_cidade?: string | null;
          endereco_complemento?: string | null;
          endereco_logradouro?: string | null;
          endereco_numero?: string | null;
          endereco_uf?: string | null;
          finalidade?: Database["public"]["Enums"]["imovel_finalidade"];
          id?: string;
          iptu?: number | null;
          latitude?: number | null;
          longitude?: number | null;
          mostrar_endereco_publico?: boolean;
          preco?: number;
          preco_anterior?: number | null;
          publicado?: boolean;
          publicado_em?: string | null;
          quartos?: number | null;
          selos?: string[];
          slug: string;
          status?: Database["public"]["Enums"]["imovel_status"];
          suites?: number | null;
          tenant_id: string;
          tipo?: Database["public"]["Enums"]["imovel_tipo"];
          titulo: string;
          updated_at?: string;
          vagas?: number | null;
        };
        Update: {
          aceita_financiamento?: boolean;
          aceita_permuta?: boolean;
          area_total?: number | null;
          area_util?: number | null;
          banheiros?: number | null;
          caracteristicas?: string[];
          codigo_interno?: string | null;
          condominio?: number | null;
          corretor_responsavel_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          custom_data?: Json;
          descricao?: string | null;
          destaque?: boolean;
          endereco_bairro?: string | null;
          endereco_cep?: string | null;
          endereco_cidade?: string | null;
          endereco_complemento?: string | null;
          endereco_logradouro?: string | null;
          endereco_numero?: string | null;
          endereco_uf?: string | null;
          finalidade?: Database["public"]["Enums"]["imovel_finalidade"];
          id?: string;
          iptu?: number | null;
          latitude?: number | null;
          longitude?: number | null;
          mostrar_endereco_publico?: boolean;
          preco?: number;
          preco_anterior?: number | null;
          publicado?: boolean;
          publicado_em?: string | null;
          quartos?: number | null;
          selos?: string[];
          slug?: string;
          status?: Database["public"]["Enums"]["imovel_status"];
          suites?: number | null;
          tenant_id?: string;
          tipo?: Database["public"]["Enums"]["imovel_tipo"];
          titulo?: string;
          updated_at?: string;
          vagas?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "imoveis_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      imovel_fotos: {
        Row: {
          capa: boolean;
          created_at: string;
          id: string;
          imovel_id: string;
          legenda: string | null;
          ordem: number;
          storage_path: string;
          tenant_id: string;
        };
        Insert: {
          capa?: boolean;
          created_at?: string;
          id?: string;
          imovel_id: string;
          legenda?: string | null;
          ordem?: number;
          storage_path: string;
          tenant_id: string;
        };
        Update: {
          capa?: boolean;
          created_at?: string;
          id?: string;
          imovel_id?: string;
          legenda?: string | null;
          ordem?: number;
          storage_path?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "imovel_fotos_imovel_id_fkey";
            columns: ["imovel_id"];
            isOneToOne: false;
            referencedRelation: "imoveis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "imovel_fotos_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      imovel_historico: {
        Row: {
          campo: string;
          changed_by: string | null;
          created_at: string;
          id: string;
          imovel_id: string;
          tenant_id: string;
          valor_anterior: string | null;
          valor_novo: string | null;
        };
        Insert: {
          campo: string;
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          imovel_id: string;
          tenant_id: string;
          valor_anterior?: string | null;
          valor_novo?: string | null;
        };
        Update: {
          campo?: string;
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          imovel_id?: string;
          tenant_id?: string;
          valor_anterior?: string | null;
          valor_novo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "imovel_historico_imovel_id_fkey";
            columns: ["imovel_id"];
            isOneToOne: false;
            referencedRelation: "imoveis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "imovel_historico_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      imovel_portais: {
        Row: {
          ativo: boolean;
          created_at: string;
          external_id: string | null;
          id: string;
          imovel_id: string;
          last_sync_at: string | null;
          last_sync_message: string | null;
          last_sync_status: string | null;
          portal_slug: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          imovel_id: string;
          last_sync_at?: string | null;
          last_sync_message?: string | null;
          last_sync_status?: string | null;
          portal_slug: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          imovel_id?: string;
          last_sync_at?: string | null;
          last_sync_message?: string | null;
          last_sync_status?: string | null;
          portal_slug?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "imovel_portais_imovel_id_fkey";
            columns: ["imovel_id"];
            isOneToOne: false;
            referencedRelation: "imoveis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "imovel_portais_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      lancamentos_financeiros: {
        Row: {
          categoria: string | null;
          centro_custo_id: string | null;
          contrato_id: string | null;
          corretor_id: string | null;
          created_at: string;
          created_by: string | null;
          data_pagamento: string | null;
          data_vencimento: string;
          descricao: string;
          id: string;
          imovel_id: string | null;
          observacoes: string | null;
          plano_conta_id: string | null;
          status: Database["public"]["Enums"]["financeiro_status"];
          tenant_id: string;
          tipo: Database["public"]["Enums"]["financeiro_tipo"];
          updated_at: string;
          valor: number;
        };
        Insert: {
          categoria?: string | null;
          centro_custo_id?: string | null;
          contrato_id?: string | null;
          corretor_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_pagamento?: string | null;
          data_vencimento?: string;
          descricao: string;
          id?: string;
          imovel_id?: string | null;
          observacoes?: string | null;
          plano_conta_id?: string | null;
          status?: Database["public"]["Enums"]["financeiro_status"];
          tenant_id: string;
          tipo: Database["public"]["Enums"]["financeiro_tipo"];
          updated_at?: string;
          valor?: number;
        };
        Update: {
          categoria?: string | null;
          centro_custo_id?: string | null;
          contrato_id?: string | null;
          corretor_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_pagamento?: string | null;
          data_vencimento?: string;
          descricao?: string;
          id?: string;
          imovel_id?: string | null;
          observacoes?: string | null;
          plano_conta_id?: string | null;
          status?: Database["public"]["Enums"]["financeiro_status"];
          tenant_id?: string;
          tipo?: Database["public"]["Enums"]["financeiro_tipo"];
          updated_at?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lancamentos_financeiros_centro_custo_id_fkey";
            columns: ["centro_custo_id"];
            isOneToOne: false;
            referencedRelation: "centros_custo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lancamentos_financeiros_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lancamentos_financeiros_plano_conta_id_fkey";
            columns: ["plano_conta_id"];
            isOneToOne: false;
            referencedRelation: "plano_contas";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_cadencia_jobs: {
        Row: {
          cadencia_id: string;
          created_at: string;
          executed_at: string | null;
          id: string;
          lead_id: string;
          resultado: string | null;
          scheduled_at: string;
          status: string;
          step_id: string;
          tenant_id: string;
        };
        Insert: {
          cadencia_id: string;
          created_at?: string;
          executed_at?: string | null;
          id?: string;
          lead_id: string;
          resultado?: string | null;
          scheduled_at: string;
          status?: string;
          step_id: string;
          tenant_id: string;
        };
        Update: {
          cadencia_id?: string;
          created_at?: string;
          executed_at?: string | null;
          id?: string;
          lead_id?: string;
          resultado?: string | null;
          scheduled_at?: string;
          status?: string;
          step_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_cadencia_jobs_cadencia_id_fkey";
            columns: ["cadencia_id"];
            isOneToOne: false;
            referencedRelation: "lead_cadencias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_cadencia_jobs_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_cadencia_jobs_step_id_fkey";
            columns: ["step_id"];
            isOneToOne: false;
            referencedRelation: "lead_cadencia_steps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_cadencia_jobs_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_cadencia_steps: {
        Row: {
          assunto: string | null;
          cadencia_id: string;
          canal: string;
          created_at: string;
          delay_horas: number;
          id: string;
          ordem: number;
          template: string;
          tenant_id: string;
        };
        Insert: {
          assunto?: string | null;
          cadencia_id: string;
          canal: string;
          created_at?: string;
          delay_horas?: number;
          id?: string;
          ordem?: number;
          template: string;
          tenant_id: string;
        };
        Update: {
          assunto?: string | null;
          cadencia_id?: string;
          canal?: string;
          created_at?: string;
          delay_horas?: number;
          id?: string;
          ordem?: number;
          template?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_cadencia_steps_cadencia_id_fkey";
            columns: ["cadencia_id"];
            isOneToOne: false;
            referencedRelation: "lead_cadencias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_cadencia_steps_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_cadencias: {
        Row: {
          ativo: boolean;
          created_at: string;
          descricao: string | null;
          id: string;
          nome: string;
          tenant_id: string;
          trigger_etapa_id: string | null;
          trigger_origem: string | null;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          nome: string;
          tenant_id: string;
          trigger_etapa_id?: string | null;
          trigger_origem?: string | null;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          nome?: string;
          tenant_id?: string;
          trigger_etapa_id?: string | null;
          trigger_origem?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_cadencias_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_cadencias_trigger_etapa_id_fkey";
            columns: ["trigger_etapa_id"];
            isOneToOne: false;
            referencedRelation: "lead_funil_etapas";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_funil_etapas: {
        Row: {
          cor: string | null;
          created_at: string;
          funil_id: string;
          id: string;
          is_ganho: boolean;
          is_perdido: boolean;
          nome: string;
          ordem: number;
          sla_horas: number | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          cor?: string | null;
          created_at?: string;
          funil_id: string;
          id?: string;
          is_ganho?: boolean;
          is_perdido?: boolean;
          nome: string;
          ordem?: number;
          sla_horas?: number | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          cor?: string | null;
          created_at?: string;
          funil_id?: string;
          id?: string;
          is_ganho?: boolean;
          is_perdido?: boolean;
          nome?: string;
          ordem?: number;
          sla_horas?: number | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_funil_etapas_funil_id_fkey";
            columns: ["funil_id"];
            isOneToOne: false;
            referencedRelation: "lead_funis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_funil_etapas_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_funis: {
        Row: {
          ativo: boolean;
          created_at: string;
          id: string;
          is_default: boolean;
          nome: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          nome: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          nome?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_funis_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_imovel_matches: {
        Row: {
          created_at: string;
          id: string;
          imovel_id: string;
          lead_id: string;
          motivo: Json;
          score: number;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          imovel_id: string;
          lead_id: string;
          motivo?: Json;
          score?: number;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          imovel_id?: string;
          lead_id?: string;
          motivo?: Json;
          score?: number;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_imovel_matches_imovel_id_fkey";
            columns: ["imovel_id"];
            isOneToOne: false;
            referencedRelation: "imoveis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_imovel_matches_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_imovel_matches_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_interacoes: {
        Row: {
          conteudo: string | null;
          created_at: string;
          id: string;
          lead_id: string;
          metadata: Json;
          tenant_id: string;
          tipo: Database["public"]["Enums"]["lead_interacao_tipo"];
          user_id: string | null;
        };
        Insert: {
          conteudo?: string | null;
          created_at?: string;
          id?: string;
          lead_id: string;
          metadata?: Json;
          tenant_id: string;
          tipo: Database["public"]["Enums"]["lead_interacao_tipo"];
          user_id?: string | null;
        };
        Update: {
          conteudo?: string | null;
          created_at?: string;
          id?: string;
          lead_id?: string;
          metadata?: Json;
          tenant_id?: string;
          tipo?: Database["public"]["Enums"]["lead_interacao_tipo"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lead_interacoes_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_mensagens: {
        Row: {
          autor_nome: string | null;
          autor_tipo: string;
          autor_user_id: string | null;
          conteudo: string;
          created_at: string;
          id: string;
          lead_id: string;
          lida_em: string | null;
          tenant_id: string;
        };
        Insert: {
          autor_nome?: string | null;
          autor_tipo?: string;
          autor_user_id?: string | null;
          conteudo: string;
          created_at?: string;
          id?: string;
          lead_id: string;
          lida_em?: string | null;
          tenant_id: string;
        };
        Update: {
          autor_nome?: string | null;
          autor_tipo?: string;
          autor_user_id?: string | null;
          conteudo?: string;
          created_at?: string;
          id?: string;
          lead_id?: string;
          lida_em?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_mensagens_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_mensagens_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_preferencias: {
        Row: {
          area_min: number | null;
          bairros: string[];
          cidades: string[];
          finalidade: string | null;
          lead_id: string;
          observacoes: string | null;
          preco_max: number | null;
          preco_min: number | null;
          quartos_min: number | null;
          tenant_id: string;
          tipos: string[];
          updated_at: string;
          vagas_min: number | null;
        };
        Insert: {
          area_min?: number | null;
          bairros?: string[];
          cidades?: string[];
          finalidade?: string | null;
          lead_id: string;
          observacoes?: string | null;
          preco_max?: number | null;
          preco_min?: number | null;
          quartos_min?: number | null;
          tenant_id: string;
          tipos?: string[];
          updated_at?: string;
          vagas_min?: number | null;
        };
        Update: {
          area_min?: number | null;
          bairros?: string[];
          cidades?: string[];
          finalidade?: string | null;
          lead_id?: string;
          observacoes?: string | null;
          preco_max?: number | null;
          preco_min?: number | null;
          quartos_min?: number | null;
          tenant_id?: string;
          tipos?: string[];
          updated_at?: string;
          vagas_min?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "lead_preferencias_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: true;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_preferencias_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_scoring_regras: {
        Row: {
          ativo: boolean;
          created_at: string;
          descricao: string | null;
          evento: string;
          id: string;
          pontos: number;
          tenant_id: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          evento: string;
          id?: string;
          pontos?: number;
          tenant_id: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          evento?: string;
          id?: string;
          pontos?: number;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_scoring_regras_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_tarefas: {
        Row: {
          concluida_em: string | null;
          created_at: string;
          created_by: string | null;
          descricao: string | null;
          id: string;
          lead_id: string;
          prazo: string | null;
          prioridade: string;
          responsavel_user_id: string | null;
          status: string;
          tenant_id: string;
          tipo: string;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          concluida_em?: string | null;
          created_at?: string;
          created_by?: string | null;
          descricao?: string | null;
          id?: string;
          lead_id: string;
          prazo?: string | null;
          prioridade?: string;
          responsavel_user_id?: string | null;
          status?: string;
          tenant_id: string;
          tipo?: string;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          concluida_em?: string | null;
          created_at?: string;
          created_by?: string | null;
          descricao?: string | null;
          id?: string;
          lead_id?: string;
          prazo?: string | null;
          prioridade?: string;
          responsavel_user_id?: string | null;
          status?: string;
          tenant_id?: string;
          tipo?: string;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          corretor_id: string | null;
          created_at: string;
          email: string | null;
          email_hash: string | null;
          etapa_id: string | null;
          funil_id: string | null;
          ganho_em: string | null;
          id: string;
          imovel_id: string | null;
          ip: string | null;
          ip_origem: string | null;
          last_contact_at: string | null;
          mensagem: string | null;
          next_action_at: string | null;
          nome: string;
          origem: Database["public"]["Enums"]["lead_origem"];
          perdido_em: string | null;
          perdido_motivo: string | null;
          referrer: string | null;
          score: number;
          sla_due_at: string | null;
          status: Database["public"]["Enums"]["lead_status"];
          telefone: string | null;
          telefone_hash: string | null;
          tenant_id: string;
          updated_at: string;
          user_agent: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_medium: string | null;
          utm_source: string | null;
          utm_term: string | null;
        };
        Insert: {
          corretor_id?: string | null;
          created_at?: string;
          email?: string | null;
          email_hash?: string | null;
          etapa_id?: string | null;
          funil_id?: string | null;
          ganho_em?: string | null;
          id?: string;
          imovel_id?: string | null;
          ip?: string | null;
          ip_origem?: string | null;
          last_contact_at?: string | null;
          mensagem?: string | null;
          next_action_at?: string | null;
          nome: string;
          origem?: Database["public"]["Enums"]["lead_origem"];
          perdido_em?: string | null;
          perdido_motivo?: string | null;
          referrer?: string | null;
          score?: number;
          sla_due_at?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          telefone?: string | null;
          telefone_hash?: string | null;
          tenant_id: string;
          updated_at?: string;
          user_agent?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
        };
        Update: {
          corretor_id?: string | null;
          created_at?: string;
          email?: string | null;
          email_hash?: string | null;
          etapa_id?: string | null;
          funil_id?: string | null;
          ganho_em?: string | null;
          id?: string;
          imovel_id?: string | null;
          ip?: string | null;
          ip_origem?: string | null;
          last_contact_at?: string | null;
          mensagem?: string | null;
          next_action_at?: string | null;
          nome?: string;
          origem?: Database["public"]["Enums"]["lead_origem"];
          perdido_em?: string | null;
          perdido_motivo?: string | null;
          referrer?: string | null;
          score?: number;
          sla_due_at?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          telefone?: string | null;
          telefone_hash?: string | null;
          tenant_id?: string;
          updated_at?: string;
          user_agent?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "lead_funil_etapas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_funil_id_fkey";
            columns: ["funil_id"];
            isOneToOne: false;
            referencedRelation: "lead_funis";
            referencedColumns: ["id"];
          },
        ];
      };
      locacao_garantias: {
        Row: {
          ativo: boolean;
          contrato_id: string;
          created_at: string;
          dados: Json;
          id: string;
          tenant_id: string;
          tipo: string;
          updated_at: string;
          valor: number | null;
          vencimento: string | null;
        };
        Insert: {
          ativo?: boolean;
          contrato_id: string;
          created_at?: string;
          dados?: Json;
          id?: string;
          tenant_id: string;
          tipo: string;
          updated_at?: string;
          valor?: number | null;
          vencimento?: string | null;
        };
        Update: {
          ativo?: boolean;
          contrato_id?: string;
          created_at?: string;
          dados?: Json;
          id?: string;
          tenant_id?: string;
          tipo?: string;
          updated_at?: string;
          valor?: number | null;
          vencimento?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "locacao_garantias_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "locacao_garantias_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      locacao_ordens_servico: {
        Row: {
          aberta_em: string;
          concluida_em: string | null;
          contrato_id: string;
          created_at: string;
          custo: number | null;
          descricao: string | null;
          id: string;
          prevista_para: string | null;
          prioridade: string;
          responsavel: string | null;
          status: string;
          tenant_id: string;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          aberta_em?: string;
          concluida_em?: string | null;
          contrato_id: string;
          created_at?: string;
          custo?: number | null;
          descricao?: string | null;
          id?: string;
          prevista_para?: string | null;
          prioridade?: string;
          responsavel?: string | null;
          status?: string;
          tenant_id: string;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          aberta_em?: string;
          concluida_em?: string | null;
          contrato_id?: string;
          created_at?: string;
          custo?: number | null;
          descricao?: string | null;
          id?: string;
          prevista_para?: string | null;
          prioridade?: string;
          responsavel?: string | null;
          status?: string;
          tenant_id?: string;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locacao_ordens_servico_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "locacao_ordens_servico_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      locacao_reajustes: {
        Row: {
          contrato_id: string;
          created_at: string;
          id: string;
          indice: string;
          observacoes: string | null;
          periodicidade_meses: number;
          proximo_reajuste: string | null;
          tenant_id: string;
          ultimo_reajuste: string | null;
          ultimo_valor: number | null;
          updated_at: string;
        };
        Insert: {
          contrato_id: string;
          created_at?: string;
          id?: string;
          indice?: string;
          observacoes?: string | null;
          periodicidade_meses?: number;
          proximo_reajuste?: string | null;
          tenant_id: string;
          ultimo_reajuste?: string | null;
          ultimo_valor?: number | null;
          updated_at?: string;
        };
        Update: {
          contrato_id?: string;
          created_at?: string;
          id?: string;
          indice?: string;
          observacoes?: string | null;
          periodicidade_meses?: number;
          proximo_reajuste?: string | null;
          tenant_id?: string;
          ultimo_reajuste?: string | null;
          ultimo_valor?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locacao_reajustes_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "locacao_reajustes_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      locacao_repasses: {
        Row: {
          contrato_id: string;
          created_at: string;
          data_recebimento: string | null;
          data_repasse: string | null;
          id: string;
          mes_referencia: string;
          observacoes: string | null;
          outros_descontos: number;
          status: string;
          taxa_admin_percentual: number;
          taxa_admin_valor: number;
          tenant_id: string;
          updated_at: string;
          valor_aluguel: number;
          valor_repasse: number;
        };
        Insert: {
          contrato_id: string;
          created_at?: string;
          data_recebimento?: string | null;
          data_repasse?: string | null;
          id?: string;
          mes_referencia: string;
          observacoes?: string | null;
          outros_descontos?: number;
          status?: string;
          taxa_admin_percentual?: number;
          taxa_admin_valor?: number;
          tenant_id: string;
          updated_at?: string;
          valor_aluguel?: number;
          valor_repasse?: number;
        };
        Update: {
          contrato_id?: string;
          created_at?: string;
          data_recebimento?: string | null;
          data_repasse?: string | null;
          id?: string;
          mes_referencia?: string;
          observacoes?: string | null;
          outros_descontos?: number;
          status?: string;
          taxa_admin_percentual?: number;
          taxa_admin_valor?: number;
          tenant_id?: string;
          updated_at?: string;
          valor_aluguel?: number;
          valor_repasse?: number;
        };
        Relationships: [
          {
            foreignKeyName: "locacao_repasses_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "locacao_repasses_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      locacao_vistorias: {
        Row: {
          contrato_id: string;
          created_at: string;
          data: string;
          fotos_urls: string[];
          id: string;
          observacoes: string | null;
          responsavel: string | null;
          status: string;
          tenant_id: string;
          tipo: string;
          updated_at: string;
        };
        Insert: {
          contrato_id: string;
          created_at?: string;
          data: string;
          fotos_urls?: string[];
          id?: string;
          observacoes?: string | null;
          responsavel?: string | null;
          status?: string;
          tenant_id: string;
          tipo: string;
          updated_at?: string;
        };
        Update: {
          contrato_id?: string;
          created_at?: string;
          data?: string;
          fotos_urls?: string[];
          id?: string;
          observacoes?: string | null;
          responsavel?: string | null;
          status?: string;
          tenant_id?: string;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locacao_vistorias_contrato_id_fkey";
            columns: ["contrato_id"];
            isOneToOne: false;
            referencedRelation: "contratos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "locacao_vistorias_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      modules: {
        Row: {
          core: boolean;
          created_at: string;
          depends_on: string[];
          descricao: string | null;
          nome: string;
          permissions: string[];
          requires_plan: string | null;
          settings_schema: Json;
          slug: string;
          updated_at: string;
          versao: string;
        };
        Insert: {
          core?: boolean;
          created_at?: string;
          depends_on?: string[];
          descricao?: string | null;
          nome: string;
          permissions?: string[];
          requires_plan?: string | null;
          settings_schema?: Json;
          slug: string;
          updated_at?: string;
          versao?: string;
        };
        Update: {
          core?: boolean;
          created_at?: string;
          depends_on?: string[];
          descricao?: string | null;
          nome?: string;
          permissions?: string[];
          requires_plan?: string | null;
          settings_schema?: Json;
          slug?: string;
          updated_at?: string;
          versao?: string;
        };
        Relationships: [
          {
            foreignKeyName: "modules_requires_plan_fkey";
            columns: ["requires_plan"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["slug"];
          },
        ];
      };
      notification_prefs: {
        Row: {
          email_comissao: boolean;
          email_contrato: boolean;
          email_novo_lead: boolean;
          email_visita: boolean;
          inapp_novo_lead: boolean;
          inapp_visita: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          email_comissao?: boolean;
          email_contrato?: boolean;
          email_novo_lead?: boolean;
          email_visita?: boolean;
          inapp_novo_lead?: boolean;
          inapp_visita?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          email_comissao?: boolean;
          email_contrato?: boolean;
          email_novo_lead?: boolean;
          email_visita?: boolean;
          inapp_novo_lead?: boolean;
          inapp_visita?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          lida_em: string | null;
          link: string | null;
          mensagem: string | null;
          metadata: Json;
          tenant_id: string;
          tipo: string;
          titulo: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          lida_em?: string | null;
          link?: string | null;
          mensagem?: string | null;
          metadata?: Json;
          tenant_id: string;
          tipo: string;
          titulo: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          lida_em?: string | null;
          link?: string | null;
          mensagem?: string | null;
          metadata?: Json;
          tenant_id?: string;
          tipo?: string;
          titulo?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_limits: {
        Row: {
          limit_key: string;
          limit_value: number;
          plan_id: string;
        };
        Insert: {
          limit_key: string;
          limit_value: number;
          plan_id: string;
        };
        Update: {
          limit_key?: string;
          limit_value?: number;
          plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_limits_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      plano_contas: {
        Row: {
          ativo: boolean;
          codigo: string;
          created_at: string;
          id: string;
          nome: string;
          parent_id: string | null;
          tenant_id: string;
          tipo: string;
        };
        Insert: {
          ativo?: boolean;
          codigo: string;
          created_at?: string;
          id?: string;
          nome: string;
          parent_id?: string | null;
          tenant_id: string;
          tipo: string;
        };
        Update: {
          ativo?: boolean;
          codigo?: string;
          created_at?: string;
          id?: string;
          nome?: string;
          parent_id?: string | null;
          tenant_id?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plano_contas_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "plano_contas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plano_contas_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          ativo: boolean;
          created_at: string;
          id: string;
          limites: Json;
          modulos_incluidos: string[];
          nome: string;
          preco_mensal: number;
          slug: string;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          id?: string;
          limites?: Json;
          modulos_incluidos?: string[];
          nome: string;
          preco_mensal?: number;
          slug: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          id?: string;
          limites?: Json;
          modulos_incluidos?: string[];
          nome?: string;
          preco_mensal?: number;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      portal_feeds: {
        Row: {
          created_at: string;
          credentials: Json;
          enabled: boolean;
          id: string;
          last_pull_ip: string | null;
          last_pull_ua: string | null;
          last_pulled_at: string | null;
          portal_slug: string;
          tenant_id: string;
          updated_at: string;
          validation_message: string | null;
          validation_status: string | null;
        };
        Insert: {
          created_at?: string;
          credentials?: Json;
          enabled?: boolean;
          id?: string;
          last_pull_ip?: string | null;
          last_pull_ua?: string | null;
          last_pulled_at?: string | null;
          portal_slug: string;
          tenant_id: string;
          updated_at?: string;
          validation_message?: string | null;
          validation_status?: string | null;
        };
        Update: {
          created_at?: string;
          credentials?: Json;
          enabled?: boolean;
          id?: string;
          last_pull_ip?: string | null;
          last_pull_ua?: string | null;
          last_pulled_at?: string | null;
          portal_slug?: string;
          tenant_id?: string;
          updated_at?: string;
          validation_message?: string | null;
          validation_status?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          id: string;
          nome: string | null;
          telefone: string | null;
          tema_preferido: string;
          tenant_id: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          id: string;
          nome?: string | null;
          telefone?: string | null;
          tema_preferido?: string;
          tenant_id?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          id?: string;
          nome?: string | null;
          telefone?: string | null;
          tema_preferido?: string;
          tenant_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      short_link_clicks: {
        Row: {
          created_at: string;
          id: string;
          ip: string | null;
          referrer: string | null;
          short_link_id: string;
          user_agent: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          ip?: string | null;
          referrer?: string | null;
          short_link_id: string;
          user_agent?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          ip?: string | null;
          referrer?: string | null;
          short_link_id?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "short_link_clicks_short_link_id_fkey";
            columns: ["short_link_id"];
            isOneToOne: false;
            referencedRelation: "short_links";
            referencedColumns: ["id"];
          },
        ];
      };
      short_links: {
        Row: {
          clicks_count: number;
          created_at: string;
          created_by: string | null;
          id: string;
          imovel_id: string | null;
          label: string | null;
          slug: string;
          target_url: string;
          tenant_id: string;
          utm_campaign: string | null;
          utm_medium: string | null;
          utm_source: string | null;
        };
        Insert: {
          clicks_count?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          imovel_id?: string | null;
          label?: string | null;
          slug: string;
          target_url: string;
          tenant_id: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
        };
        Update: {
          clicks_count?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          imovel_id?: string | null;
          label?: string | null;
          slug?: string;
          target_url?: string;
          tenant_id?: string;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "short_links_imovel_id_fkey";
            columns: ["imovel_id"];
            isOneToOne: false;
            referencedRelation: "imoveis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "short_links_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      suppressed_emails: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          metadata: Json | null;
          reason: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          metadata?: Json | null;
          reason: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          metadata?: Json | null;
          reason?: string;
        };
        Relationships: [];
      };
      tenant_api_keys: {
        Row: {
          ativo: boolean;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          key_hash: string;
          key_prefix: string;
          last_used_at: string | null;
          nome: string;
          scopes: string[];
          tenant_id: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          key_hash: string;
          key_prefix: string;
          last_used_at?: string | null;
          nome: string;
          scopes?: string[];
          tenant_id: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          key_hash?: string;
          key_prefix?: string;
          last_used_at?: string | null;
          nome?: string;
          scopes?: string[];
          tenant_id?: string;
        };
        Relationships: [];
      };
      tenant_custom_fields: {
        Row: {
          chave: string;
          created_at: string;
          entidade: string;
          id: string;
          obrigatorio: boolean;
          opcoes: string[];
          ordem: number;
          rotulo: string;
          tenant_id: string;
          tipo: string;
          updated_at: string;
        };
        Insert: {
          chave: string;
          created_at?: string;
          entidade?: string;
          id?: string;
          obrigatorio?: boolean;
          opcoes?: string[];
          ordem?: number;
          rotulo: string;
          tenant_id: string;
          tipo?: string;
          updated_at?: string;
        };
        Update: {
          chave?: string;
          created_at?: string;
          entidade?: string;
          id?: string;
          obrigatorio?: boolean;
          opcoes?: string[];
          ordem?: number;
          rotulo?: string;
          tenant_id?: string;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_custom_fields_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_domains: {
        Row: {
          created_at: string;
          dominio: string;
          id: string;
          primario: boolean;
          tenant_id: string;
          updated_at: string;
          verificado: boolean;
          verification_token: string;
        };
        Insert: {
          created_at?: string;
          dominio: string;
          id?: string;
          primario?: boolean;
          tenant_id: string;
          updated_at?: string;
          verificado?: boolean;
          verification_token?: string;
        };
        Update: {
          created_at?: string;
          dominio?: string;
          id?: string;
          primario?: boolean;
          tenant_id?: string;
          updated_at?: string;
          verificado?: boolean;
          verification_token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_feature_flags: {
        Row: {
          enabled: boolean;
          flag_key: string;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          enabled?: boolean;
          flag_key: string;
          tenant_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          enabled?: boolean;
          flag_key?: string;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_feature_flags_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_lead_settings: {
        Row: {
          last_assigned_corretor_id: string | null;
          round_robin_enabled: boolean;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          last_assigned_corretor_id?: string | null;
          round_robin_enabled?: boolean;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          last_assigned_corretor_id?: string | null;
          round_robin_enabled?: boolean;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tenant_modules: {
        Row: {
          created_at: string;
          enabled: boolean;
          module_slug: string;
          settings: Json;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          module_slug: string;
          settings?: Json;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          module_slug?: string;
          settings?: Json;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_modules_module_slug_fkey";
            columns: ["module_slug"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["slug"];
          },
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_pages: {
        Row: {
          conteudo_html: string;
          created_at: string;
          id: string;
          meta_description: string | null;
          ordem: number;
          publicada: boolean;
          slug: string;
          tenant_id: string;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          conteudo_html?: string;
          created_at?: string;
          id?: string;
          meta_description?: string | null;
          ordem?: number;
          publicada?: boolean;
          slug: string;
          tenant_id: string;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          conteudo_html?: string;
          created_at?: string;
          id?: string;
          meta_description?: string | null;
          ordem?: number;
          publicada?: boolean;
          slug?: string;
          tenant_id?: string;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tenant_site_settings: {
        Row: {
          contato_email: string | null;
          contato_telefone: string | null;
          contato_whatsapp: string | null;
          cor_destaque: string | null;
          created_at: string;
          endereco: string | null;
          facebook_url: string | null;
          fb_pixel_id: string | null;
          ga4_id: string | null;
          google_ads_id: string | null;
          gtm_id: string | null;
          head_custom_html: string | null;
          hero_cta_label: string | null;
          hero_subtitulo: string | null;
          hero_titulo: string | null;
          hotjar_id: string | null;
          instagram_url: string | null;
          linkedin_url: string | null;
          meta_description: string | null;
          publicado: boolean;
          sobre_html: string | null;
          tenant_id: string;
          updated_at: string;
          youtube_url: string | null;
        };
        Insert: {
          contato_email?: string | null;
          contato_telefone?: string | null;
          contato_whatsapp?: string | null;
          cor_destaque?: string | null;
          created_at?: string;
          endereco?: string | null;
          facebook_url?: string | null;
          fb_pixel_id?: string | null;
          ga4_id?: string | null;
          google_ads_id?: string | null;
          gtm_id?: string | null;
          head_custom_html?: string | null;
          hero_cta_label?: string | null;
          hero_subtitulo?: string | null;
          hero_titulo?: string | null;
          hotjar_id?: string | null;
          instagram_url?: string | null;
          linkedin_url?: string | null;
          meta_description?: string | null;
          publicado?: boolean;
          sobre_html?: string | null;
          tenant_id: string;
          updated_at?: string;
          youtube_url?: string | null;
        };
        Update: {
          contato_email?: string | null;
          contato_telefone?: string | null;
          contato_whatsapp?: string | null;
          cor_destaque?: string | null;
          created_at?: string;
          endereco?: string | null;
          facebook_url?: string | null;
          fb_pixel_id?: string | null;
          ga4_id?: string | null;
          google_ads_id?: string | null;
          gtm_id?: string | null;
          head_custom_html?: string | null;
          hero_cta_label?: string | null;
          hero_subtitulo?: string | null;
          hero_titulo?: string | null;
          hotjar_id?: string | null;
          instagram_url?: string | null;
          linkedin_url?: string | null;
          meta_description?: string | null;
          publicado?: boolean;
          sobre_html?: string | null;
          tenant_id?: string;
          updated_at?: string;
          youtube_url?: string | null;
        };
        Relationships: [];
      };
      tenant_usage_snapshots: {
        Row: {
          contratos_ativos: number;
          created_at: string;
          id: string;
          imoveis_count: number;
          leads_count: number;
          mensagens_count: number;
          snapshot_date: string;
          tenant_id: string;
          usuarios_count: number;
        };
        Insert: {
          contratos_ativos?: number;
          created_at?: string;
          id?: string;
          imoveis_count?: number;
          leads_count?: number;
          mensagens_count?: number;
          snapshot_date?: string;
          tenant_id: string;
          usuarios_count?: number;
        };
        Update: {
          contratos_ativos?: number;
          created_at?: string;
          id?: string;
          imoveis_count?: number;
          leads_count?: number;
          mensagens_count?: number;
          snapshot_date?: string;
          tenant_id?: string;
          usuarios_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_usage_snapshots_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_webhooks: {
        Row: {
          ativo: boolean;
          created_at: string;
          created_by: string | null;
          eventos: string[];
          id: string;
          nome: string;
          secret: string;
          tenant_id: string;
          updated_at: string;
          url: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          created_by?: string | null;
          eventos?: string[];
          id?: string;
          nome: string;
          secret?: string;
          tenant_id: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          created_by?: string | null;
          eventos?: string[];
          id?: string;
          nome?: string;
          secret?: string;
          tenant_id?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_webhooks_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          cnpj: string | null;
          created_at: string;
          creci_juridico: string | null;
          dominio_proprio: string | null;
          id: string;
          nome: string;
          plano_slug: string | null;
          slug: string;
          status: Database["public"]["Enums"]["tenant_status"];
          tema: Json;
          updated_at: string;
          watermark: Json;
        };
        Insert: {
          cnpj?: string | null;
          created_at?: string;
          creci_juridico?: string | null;
          dominio_proprio?: string | null;
          id?: string;
          nome: string;
          plano_slug?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["tenant_status"];
          tema?: Json;
          updated_at?: string;
          watermark?: Json;
        };
        Update: {
          cnpj?: string | null;
          created_at?: string;
          creci_juridico?: string | null;
          dominio_proprio?: string | null;
          id?: string;
          nome?: string;
          plano_slug?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["tenant_status"];
          tema?: Json;
          updated_at?: string;
          watermark?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "tenants_plano_slug_fkey";
            columns: ["plano_slug"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["slug"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          tenant_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          tenant_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          tenant_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      visitas: {
        Row: {
          checkin_at: string | null;
          checkin_token: string | null;
          corretor_id: string | null;
          created_at: string;
          created_by: string | null;
          data_hora: string;
          duracao_min: number;
          id: string;
          imovel_id: string;
          lead_id: string | null;
          lembrete_enviado_at: string | null;
          nps_comentario: string | null;
          nps_enviado_at: string | null;
          nps_respondido_at: string | null;
          nps_score: number | null;
          observacoes: string | null;
          status: Database["public"]["Enums"]["visita_status"];
          tenant_id: string;
          updated_at: string;
          visitante_email: string | null;
          visitante_nome: string | null;
          visitante_telefone: string | null;
        };
        Insert: {
          checkin_at?: string | null;
          checkin_token?: string | null;
          corretor_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_hora: string;
          duracao_min?: number;
          id?: string;
          imovel_id: string;
          lead_id?: string | null;
          lembrete_enviado_at?: string | null;
          nps_comentario?: string | null;
          nps_enviado_at?: string | null;
          nps_respondido_at?: string | null;
          nps_score?: number | null;
          observacoes?: string | null;
          status?: Database["public"]["Enums"]["visita_status"];
          tenant_id: string;
          updated_at?: string;
          visitante_email?: string | null;
          visitante_nome?: string | null;
          visitante_telefone?: string | null;
        };
        Update: {
          checkin_at?: string | null;
          checkin_token?: string | null;
          corretor_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_hora?: string;
          duracao_min?: number;
          id?: string;
          imovel_id?: string;
          lead_id?: string | null;
          lembrete_enviado_at?: string | null;
          nps_comentario?: string | null;
          nps_enviado_at?: string | null;
          nps_respondido_at?: string | null;
          nps_score?: number | null;
          observacoes?: string | null;
          status?: Database["public"]["Enums"]["visita_status"];
          tenant_id?: string;
          updated_at?: string;
          visitante_email?: string | null;
          visitante_nome?: string | null;
          visitante_telefone?: string | null;
        };
        Relationships: [];
      };
      webhook_deliveries: {
        Row: {
          created_at: string;
          delivered_at: string | null;
          evento: string;
          id: string;
          last_error: string | null;
          payload: Json;
          response_body: string | null;
          response_status: number | null;
          status: string;
          tenant_id: string;
          tentativas: number;
          webhook_id: string;
        };
        Insert: {
          created_at?: string;
          delivered_at?: string | null;
          evento: string;
          id?: string;
          last_error?: string | null;
          payload: Json;
          response_body?: string | null;
          response_status?: number | null;
          status?: string;
          tenant_id: string;
          tentativas?: number;
          webhook_id: string;
        };
        Update: {
          created_at?: string;
          delivered_at?: string | null;
          evento?: string;
          id?: string;
          last_error?: string | null;
          payload?: Json;
          response_body?: string | null;
          response_status?: number | null;
          status?: string;
          tenant_id?: string;
          tentativas?: number;
          webhook_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey";
            columns: ["webhook_id"];
            isOneToOne: false;
            referencedRelation: "tenant_webhooks";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      assign_lead_round_robin: { Args: { _tenant_id: string }; Returns: string };
      compute_lead_matches: { Args: { _lead_id: string }; Returns: number };
      cron_snapshot_tenant_usage: { Args: never; Returns: number };
      current_tenant_id: { Args: { _user_id: string }; Returns: string };
      delete_email: {
        Args: { message_id: number; queue_name: string };
        Returns: boolean;
      };
      enqueue_email: {
        Args: { payload: Json; queue_name: string };
        Returns: number;
      };
      enqueue_webhook: {
        Args: { _evento: string; _payload: Json; _tenant_id: string };
        Returns: undefined;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      has_role_in_tenant: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _tenant_id: string;
          _user_id: string;
        };
        Returns: boolean;
      };
      is_member_of_tenant: {
        Args: { _tenant_id: string; _user_id: string };
        Returns: boolean;
      };
      move_to_dlq: {
        Args: {
          dlq_name: string;
          message_id: number;
          payload: Json;
          source_queue: string;
        };
        Returns: number;
      };
      public_create_lead: {
        Args: {
          _email: string;
          _imovel_id: string;
          _mensagem: string;
          _nome: string;
          _telefone: string;
        };
        Returns: string;
      };
      public_create_tenant_lead: {
        Args: {
          _email: string;
          _mensagem: string;
          _nome: string;
          _telefone: string;
          _tenant_slug: string;
        };
        Returns: string;
      };
      public_historico_preco: {
        Args: { _imovel_id: string };
        Returns: {
          created_at: string;
          valor_anterior: string;
          valor_novo: string;
        }[];
      };
      public_minhas_visitas: {
        Args: never;
        Returns: {
          checkin_token: string;
          data_hora: string;
          id: string;
          imovel_endereco: string;
          imovel_id: string;
          imovel_slug: string;
          imovel_titulo: string;
          nps_score: number;
          observacoes: string;
          status: Database["public"]["Enums"]["visita_status"];
          tenant_nome: string;
          visitante_nome: string;
          visitante_telefone: string;
        }[];
      };
      public_solicitar_visita: {
        Args: {
          _data_hora: string;
          _email: string;
          _imovel_id: string;
          _mensagem: string;
          _nome: string;
          _telefone: string;
        };
        Returns: string;
      };
      public_visita_checkin: { Args: { _token: string }; Returns: Json };
      public_visita_nps: {
        Args: { _comentario: string; _score: number; _token: string };
        Returns: undefined;
      };
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number };
        Returns: {
          message: Json;
          msg_id: number;
          read_ct: number;
        }[];
      };
      tenant_modules_quota: {
        Args: { _tenant_id: string };
        Returns: {
          quota: number;
          used: number;
        }[];
      };
    };
    Enums: {
      app_role: "super_admin" | "admin" | "broker" | "juridico" | "financeiro" | "atendente";
      comissao_status: "a_pagar" | "paga" | "cancelada";
      contrato_status: "rascunho" | "ativo" | "encerrado" | "cancelado";
      contrato_tipo:
        | "venda"
        | "locacao"
        | "permuta"
        | "outro"
        | "parceria"
        | "administracao"
        | "prestacao_servico";
      financeiro_status: "pendente" | "pago" | "atrasado" | "cancelado";
      financeiro_tipo: "receita" | "despesa";
      imovel_finalidade: "venda" | "aluguel" | "temporada";
      imovel_status: "rascunho" | "ativo" | "inativo" | "vendido" | "alugado" | "reservado";
      imovel_tipo:
        | "apartamento"
        | "casa"
        | "casa_condominio"
        | "sobrado"
        | "cobertura"
        | "flat"
        | "kitnet"
        | "terreno"
        | "sitio"
        | "chacara"
        | "fazenda"
        | "comercial_sala"
        | "comercial_loja"
        | "comercial_galpao"
        | "comercial_predio"
        | "outro";
      lead_interacao_tipo:
        | "nota"
        | "ligacao"
        | "whatsapp"
        | "email"
        | "visita"
        | "mudanca_etapa"
        | "atribuicao";
      lead_origem: "site" | "whatsapp" | "portal" | "indicacao" | "manual" | "outro" | "api";
      lead_status: "novo" | "contato" | "visita" | "proposta" | "ganho" | "perdido";
      parte_papel:
        | "comprador"
        | "vendedor"
        | "locador"
        | "locatario"
        | "fiador"
        | "procurador"
        | "outro";
      tenant_status: "trial" | "active" | "suspended" | "cancelled";
      visita_status: "agendada" | "confirmada" | "realizada" | "cancelada" | "nao_compareceu";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "broker", "juridico", "financeiro", "atendente"],
      comissao_status: ["a_pagar", "paga", "cancelada"],
      contrato_status: ["rascunho", "ativo", "encerrado", "cancelado"],
      contrato_tipo: [
        "venda",
        "locacao",
        "permuta",
        "outro",
        "parceria",
        "administracao",
        "prestacao_servico",
      ],
      financeiro_status: ["pendente", "pago", "atrasado", "cancelado"],
      financeiro_tipo: ["receita", "despesa"],
      imovel_finalidade: ["venda", "aluguel", "temporada"],
      imovel_status: ["rascunho", "ativo", "inativo", "vendido", "alugado", "reservado"],
      imovel_tipo: [
        "apartamento",
        "casa",
        "casa_condominio",
        "sobrado",
        "cobertura",
        "flat",
        "kitnet",
        "terreno",
        "sitio",
        "chacara",
        "fazenda",
        "comercial_sala",
        "comercial_loja",
        "comercial_galpao",
        "comercial_predio",
        "outro",
      ],
      lead_interacao_tipo: [
        "nota",
        "ligacao",
        "whatsapp",
        "email",
        "visita",
        "mudanca_etapa",
        "atribuicao",
      ],
      lead_origem: ["site", "whatsapp", "portal", "indicacao", "manual", "outro", "api"],
      lead_status: ["novo", "contato", "visita", "proposta", "ganho", "perdido"],
      parte_papel: [
        "comprador",
        "vendedor",
        "locador",
        "locatario",
        "fiador",
        "procurador",
        "outro",
      ],
      tenant_status: ["trial", "active", "suspended", "cancelled"],
      visita_status: ["agendada", "confirmada", "realizada", "cancelada", "nao_compareceu"],
    },
  },
} as const;
